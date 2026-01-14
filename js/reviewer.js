// ==========================================
// REVIEWER MODE (Researcher tool)
// ==========================================

function _qs(id) {
    return document.getElementById(id);
}

function _escapeHtml(s) {
    return String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function _highlightMasksInHtml(html) {
    // The backend keeps <MASK>...</MASK> in responseText.
    // After marked() runs, those tags remain as literal tags and we can style them.
    // Convert to semantic spans for consistent display.
    return String(html)
        .replaceAll('<MASK>', '<span class="mask-highlight">')
        .replaceAll('</MASK>', '</span>');
}

function _renderResponseForReview(responseText) {
    // Render markdown then highlight mask spans.
    const raw = String(responseText ?? '');
    const mdHtml = (window.marked ? marked.parse(raw) : _escapeHtml(raw).replaceAll('\n', '<br/>'));
    return _highlightMasksInHtml(mdHtml);
}

async function reviewFetchSessions() {
    const r = await fetch(`${CONFIG.API_BASE_URL}/api/review/sessions`);
    if (!r.ok) throw new Error(`Failed to load sessions: ${r.status}`);
    return r.json();
}

async function reviewFetchTurns(sessionId) {
    const r = await fetch(`${CONFIG.API_BASE_URL}/api/review/session/${encodeURIComponent(sessionId)}/turns`);
    if (!r.ok) throw new Error(`Failed to load turns: ${r.status}`);
    return r.json();
}

async function reviewFetchReviews(sessionId) {
    const r = await fetch(`${CONFIG.API_BASE_URL}/api/review/session/${encodeURIComponent(sessionId)}/reviews`);
    if (!r.ok) throw new Error(`Failed to load reviews: ${r.status}`);
    return r.json();
}

async function reviewPostReview(sessionId, payload) {
    const r = await fetch(`${CONFIG.API_BASE_URL}/api/review/session/${encodeURIComponent(sessionId)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to save review: ${r.status}`);
    }
    return r.json();
}

async function refreshReviewerReviewsInPlace(sessionId) {
    // Refetch only reviews, then update existing DOM nodes in-place.
    const status = _qs('reviewer-status');
    try {
        const reviewsData = await reviewFetchReviews(sessionId);
        const reviews = Array.isArray(reviewsData?.reviews) ? reviewsData.reviews : [];
        const byTurnMask = _indexReviewsByTurnMask(reviews);
        const latestDecisionMask = _latestDecisionByReviewerTurnMask(reviews);
        const myReviewerId = getReviewerId();

        const blocks = document.querySelectorAll('[data-review-mask="1"]');
        blocks.forEach((el) => {
            const ti = parseInt(el.getAttribute('data-turn') || '', 10);
            const mi = parseInt(el.getAttribute('data-mask') || '', 10);
            if (!Number.isFinite(ti) || !Number.isFinite(mi)) return;

            const key = _reviewKey(ti, mi);
            const rlist = byTurnMask.get(key) || [];
            const s = _summarizeTurnReviews(rlist);

            const countsEl = el.querySelector('[data-role="mask-counts"]');
            if (countsEl) {
                countsEl.textContent = `Agree: ${s.agree} · Disagree: ${s.disagree} · Reviewers: ${s.reviewers}`;
            }

            const myK = myReviewerId ? _reviewerKey(myReviewerId, ti, mi) : null;
            const myD = myK ? (latestDecisionMask.get(myK) || null) : null;

            const myEl = el.querySelector('[data-role="mask-your"]');
            if (myEl) {
                myEl.textContent = myD || '—';
                myEl.classList.remove('text-indigo-700', 'text-slate-900', 'text-slate-500');
                if (myD === 'agree') myEl.classList.add('text-indigo-700');
                else if (myD === 'disagree') myEl.classList.add('text-slate-900');
                else myEl.classList.add('text-slate-500');
            }

            const agreeBtn = el.querySelector('button.mask-agree');
            const disagreeBtn = el.querySelector('button.mask-disagree');
            if (agreeBtn) agreeBtn.classList.remove('ring-2', 'ring-indigo-300');
            if (disagreeBtn) disagreeBtn.classList.remove('ring-2', 'ring-slate-400');
            if (myD === 'agree' && agreeBtn) agreeBtn.classList.add('ring-2', 'ring-indigo-300');
            if (myD === 'disagree' && disagreeBtn) disagreeBtn.classList.add('ring-2', 'ring-slate-400');
        });

    } catch (e) {
        console.error(e);
        if (status) status.textContent = `Refresh failed: ${String(e.message || e)}`;
    }
}

function enterReviewerMode() {
    const reviewerView = _qs('reviewer-view');
    const studyView = _qs('study-view');
    const chatView = _qs('chat-view');
    const quizView = _qs('quiz-view');

    if (studyView) studyView.classList.add('hidden');
    if (chatView) chatView.classList.add('hidden');
    if (quizView) quizView.classList.add('hidden');
    if (reviewerView) reviewerView.classList.remove('hidden');

    // Pre-fill reviewerId
    const reviewerIdInput = _qs('reviewer-id-input');
    if (reviewerIdInput) {
        try {
            reviewerIdInput.value = window.localStorage.getItem('REVIEWER_ID') || '';
        } catch (_) {}
    }

    syncReviewerIdentityUI();

    // Load sessions list
    refreshReviewerSessions();
}

function exitReviewerMode() {
    const reviewerView = _qs('reviewer-view');
    if (reviewerView) reviewerView.classList.add('hidden');

    // Back to study selection as default
    const studyView = _qs('study-view');
    const chatView = _qs('chat-view');
    const quizView = _qs('quiz-view');
    if (studyView) studyView.classList.remove('hidden');
    if (chatView) chatView.classList.add('hidden');
    if (quizView) quizView.classList.add('hidden');
}

async function refreshReviewerSessions() {
    const select = _qs('review-session-select');
    const status = _qs('reviewer-status');
    if (!select) return;

    if (status) status.textContent = 'Loading sessions…';

    try {
        const data = await reviewFetchSessions();
        const sessions = Array.isArray(data?.sessions) ? data.sessions : [];

        const current = select.value;
        select.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = sessions.length ? 'Select a session…' : 'No sessions found';
        select.appendChild(placeholder);

        for (const s of sessions) {
            const opt = document.createElement('option');
            opt.value = s.sessionId;
            opt.textContent = `${s.sessionId}`;
            select.appendChild(opt);
        }

        if (current && sessions.some(s => s.sessionId === current)) {
            select.value = current;
        } else {
            select.value = '';
        }

        if (status) status.textContent = `Loaded ${sessions.length} sessions.`;
    } catch (e) {
        console.error(e);
        if (status) status.textContent = `Failed to load sessions: ${String(e.message || e)}`;
    }
}

function syncReviewerIdentityUI() {
    const reviewerIdInput = _qs('reviewer-id-input');
    const current = _qs('reviewer-current');
    const v = String(reviewerIdInput?.value || '').trim();
    if (current) current.textContent = v || '(not set)';
}

function getReviewerId() {
    const reviewerIdInput = _qs('reviewer-id-input');
    return String(reviewerIdInput?.value || '').trim();
}

function _reviewKey(turnIndex, maskIndex) {
    if (maskIndex === null || maskIndex === undefined) return `${turnIndex}::turn`;
    return `${turnIndex}::${String(maskIndex)}`;
}

function _reviewerKey(reviewerId, turnIndex, maskIndex) {
    const rid = String(reviewerId || '').trim();
    return `${rid}::${_reviewKey(turnIndex, maskIndex)}`;
}

function _latestDecisionByReviewerAndTurn(reviews) {
    // reviews are read in file order; last write wins for the same reviewerId+turnIndex.
    const map = new Map();
    for (const r of reviews || []) {
        const rid = String(r?.reviewerId || '').trim();
        const ti = r?.turnIndex;
        const decision = r?.decision;
        if (!rid || ti === undefined || ti === null) continue;
        map.set(`${rid}::${ti}`, decision);
    }
    return map;
}

function _latestDecisionByReviewerTurnMask(reviews) {
    // Last write wins for (reviewerId, turnIndex, maskIndex)
    const map = new Map();
    for (const r of reviews || []) {
        const rid = String(r?.reviewerId || '').trim();
        const ti = r?.turnIndex;
        if (!rid || ti === undefined || ti === null) continue;
        const mi = (r?.maskIndex === undefined ? null : r?.maskIndex);
        map.set(_reviewerKey(rid, ti, mi), r?.decision);
    }
    return map;
}

function _indexReviewsByTurn(reviews) {
    const byTurn = new Map();
    for (const r of reviews || []) {
        const ti = r?.turnIndex;
        if (ti === undefined || ti === null) continue;
        if (!byTurn.has(ti)) byTurn.set(ti, []);
        byTurn.get(ti).push(r);
    }
    return byTurn;
}

function _indexReviewsByTurnMask(reviews) {
    const byKey = new Map();
    for (const r of reviews || []) {
        const ti = r?.turnIndex;
        if (ti === undefined || ti === null) continue;
        const mi = (r?.maskIndex === undefined ? null : r?.maskIndex);
        const key = _reviewKey(ti, mi);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(r);
    }
    return byKey;
}

function _summarizeTurnReviews(turnReviews) {
    let agree = 0;
    let disagree = 0;
    const reviewers = new Set();
    for (const r of turnReviews || []) {
        if (r?.decision === 'agree') agree++;
        if (r?.decision === 'disagree') disagree++;
        if (r?.reviewerId) reviewers.add(r.reviewerId);
    }
    return { agree, disagree, reviewers: reviewers.size };
}

async function loadSelectedSessionForReview() {
    const select = _qs('review-session-select');
    const status = _qs('reviewer-status');
    const list = _qs('review-turns');

    if (!select || !list) return;
    const sessionId = select.value;
    list.innerHTML = '';

    if (!sessionId) {
        if (status) status.textContent = 'Select a session to review.';
        return;
    }

    if (status) status.textContent = 'Loading session logs…';

    try {
        const [turnsData, reviewsData] = await Promise.all([
            reviewFetchTurns(sessionId),
            reviewFetchReviews(sessionId),
        ]);

        const turns = Array.isArray(turnsData?.turns) ? turnsData.turns : [];
        const reviews = Array.isArray(reviewsData?.reviews) ? reviewsData.reviews : [];
        const byTurn = _indexReviewsByTurn(reviews);
        const byTurnMask = _indexReviewsByTurnMask(reviews);
        const latestDecision = _latestDecisionByReviewerAndTurn(reviews);
        const latestDecisionMask = _latestDecisionByReviewerTurnMask(reviews);
        const myReviewerId = getReviewerId();

        if (status) status.textContent = `Loaded ${turns.length} turns. Existing reviews: ${reviews.length}.`;

        for (const t of turns) {
            const ti = t?.turnIndex;
            const llm = t?.llmResponse || {};
            const responseText = llm?.responseText || '';
            const maskedWords = Array.isArray(llm?.maskedWords) ? llm.maskedWords : [];
            const usesScaffolding = llm?.usesScaffolding;
            const scaffoldType = llm?.scaffoldType ?? null;
            const scaffoldIntent = llm?.scaffoldIntent ?? null;

            const turnReviews = byTurn.get(ti) || [];
            const summary = _summarizeTurnReviews(turnReviews);

            const myKey = myReviewerId ? `${myReviewerId}::${ti}` : null;
            const myDecision = myKey ? (latestDecision.get(myKey) || null) : null;

            const card = document.createElement('div');
            card.className = 'bg-white border border-slate-200 rounded-xl p-4 shadow-sm';

            const metaLine = `Turn ${_escapeHtml(ti)} · proofId=${_escapeHtml(t?.proofId)} · phaseIndex=${_escapeHtml(t?.phaseIndex)} · conditionId=${_escapeHtml(t?.conditionId)} · studyMode=${_escapeHtml(t?.studyMode)} · interactive=${_escapeHtml(t?.interactive)}`;
            const scaffoldBadges = `
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-mono text-slate-500">usesScaffolding=${_escapeHtml(usesScaffolding)}</span>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <span class="opacity-80">means</span>
                        <span>${_escapeHtml(scaffoldType)}</span>
                    </span>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <span class="opacity-80">intent</span>
                        <span>${_escapeHtml(scaffoldIntent)}</span>
                    </span>
                </div>
            `;

            card.innerHTML = `
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="text-xs font-mono text-slate-500 mb-2">${metaLine}</div>
                        <div class="mb-2">${scaffoldBadges}</div>
                        <div class="text-sm text-slate-800 mb-3"><span class="font-semibold">User:</span> ${_escapeHtml(t?.userText || '')}</div>
                    </div>
                    <div class="text-xs font-semibold text-slate-600 whitespace-nowrap">
                        Agree: ${summary.agree} · Disagree: ${summary.disagree} · Reviewers: ${summary.reviewers}
                    </div>
                </div>
                <div class="prose prose-sm max-w-none text-slate-700 border border-slate-100 rounded-lg p-3 bg-slate-50" id="review-response-${_escapeHtml(ti)}"></div>
                <div class="mt-3 text-xs text-slate-500">Masks detected: ${maskedWords.length}</div>
                <div class="mt-2" id="review-masks-${_escapeHtml(ti)}"></div>
            `;

            list.appendChild(card);

            const respEl = card.querySelector(`#review-response-${CSS.escape(String(ti))}`);
            if (respEl) {
                respEl.innerHTML = _renderResponseForReview(responseText);
                if (window.MathJax?.typesetPromise) {
                    window.MathJax.typesetPromise([respEl]).catch(() => {});
                }
            }

            // Sentence-level mask rating UI
            const masksHost = card.querySelector(`#review-masks-${CSS.escape(String(ti))}`);
            if (masksHost) {
                if (!maskedWords.length) {
                    // Legacy: keep any existing turn-level decision visible, but reviewer should rate masks when present.
                    masksHost.innerHTML = `
                        <div class="text-xs text-slate-600">
                            Your (legacy) response-level decision: <span class="font-bold ${myDecision === 'agree' ? 'text-indigo-700' : myDecision === 'disagree' ? 'text-slate-900' : 'text-slate-500'}">${_escapeHtml(myDecision || '—')}</span>
                        </div>
                        <div class="text-xs text-slate-500 mt-1">No masked sentences in this response.</div>
                    `;
                } else {
                    const blocks = [];
                    for (let mi = 0; mi < maskedWords.length; mi++) {
                        const maskedText = String(maskedWords[mi] ?? '');
                        const key = _reviewKey(ti, mi);
                        const rlist = byTurnMask.get(key) || [];
                        const s = _summarizeTurnReviews(rlist);

                        const myK = myReviewerId ? _reviewerKey(myReviewerId, ti, mi) : null;
                        const myD = myK ? (latestDecisionMask.get(myK) || null) : null;

                        const agreeRing = myD === 'agree' ? 'ring-2 ring-indigo-300' : '';
                        const disagreeRing = myD === 'disagree' ? 'ring-2 ring-slate-400' : '';

                        blocks.push(`
                            <div class="mt-3 border border-slate-200 rounded-lg p-3 bg-white" data-review-mask="1" data-turn="${_escapeHtml(ti)}" data-mask="${mi}">
                                <div class="flex items-start justify-between gap-3">
                                    <div class="text-sm text-slate-800 flex-1">
                                        <span class="text-xs font-mono text-slate-500 mr-2">Mask ${mi + 1}</span>
                                        <span class="mask-highlight">${_escapeHtml(maskedText)}</span>
                                    </div>
                                    <div class="text-xs font-semibold text-slate-600 whitespace-nowrap">
                                        <span data-role="mask-counts">Agree: ${s.agree} · Disagree: ${s.disagree} · Reviewers: ${s.reviewers}</span>
                                    </div>
                                </div>
                                <div class="text-xs text-slate-600 mt-2">
                                    Your decision: <span data-role="mask-your" class="font-bold ${myD === 'agree' ? 'text-indigo-700' : myD === 'disagree' ? 'text-slate-900' : 'text-slate-500'}">${_escapeHtml(myD || '—')}</span>
                                </div>
                                <div class="mt-2 flex gap-2">
                                    <button class="mask-agree ${agreeRing} bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 active:scale-95" data-turn="${_escapeHtml(ti)}" data-mask="${mi}">Agree</button>
                                    <button class="mask-disagree ${disagreeRing} bg-slate-200 text-slate-800 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-300 active:scale-95" data-turn="${_escapeHtml(ti)}" data-mask="${mi}">Disagree</button>
                                </div>
                            </div>
                        `);
                    }
                    masksHost.innerHTML = blocks.join('');

                    const buttons = masksHost.querySelectorAll('button.mask-agree, button.mask-disagree');
                    buttons.forEach((btn) => {
                        btn.onclick = async () => {
                            const reviewerId = getReviewerId();
                            if (!reviewerId) {
                                if (status) status.textContent = 'Please enter Reviewer ID first.';
                                return;
                            }
                            const maskIndex = parseInt(btn.dataset.mask, 10);
                            const decision = btn.classList.contains('mask-agree') ? 'agree' : 'disagree';
                            const maskedText = String(maskedWords[maskIndex] ?? '');

                            const myK = _reviewerKey(reviewerId, ti, maskIndex);
                            const prev = latestDecisionMask.get(myK) || null;
                            if (prev && prev === decision) {
                                if (status) status.textContent = `Already saved: turn=${ti} mask=${maskIndex + 1} decision=${decision}`;
                                return;
                            }

                            try {
                                window.localStorage.setItem('REVIEWER_ID', reviewerId);
                            } catch (_) {}
                            syncReviewerIdentityUI();

                            try {
                                await reviewPostReview(sessionId, {
                                    reviewerId,
                                    decision,
                                    turnIndex: ti,
                                    maskIndex,
                                    maskedText,
                                    proofId: t?.proofId ?? null,
                                    phaseIndex: t?.phaseIndex ?? null,
                                    conditionId: t?.conditionId ?? null,
                                    studyMode: t?.studyMode ?? null,
                                    interactive: t?.interactive ?? null,
                                    clientTs: new Date().toISOString(),
                                });
                                if (status) status.textContent = `Saved: session=${sessionId} turn=${ti} mask=${maskIndex + 1} decision=${decision}`;
                                // Refresh counts/your-decision in-place without rebuilding the list.
                                await refreshReviewerReviewsInPlace(sessionId);
                            } catch (e) {
                                console.error(e);
                                if (status) status.textContent = `Save failed: ${String(e.message || e)}`;
                            }
                        };
                    });
                }
            }
        }

    } catch (e) {
        console.error(e);
        if (status) status.textContent = `Failed to load session: ${String(e.message || e)}`;
    }
}

function initializeReviewerUI() {
    const openBtn = _qs('open-reviewer');
    const closeBtn = _qs('close-reviewer');
    const refreshBtn = _qs('refresh-review-sessions');
    const select = _qs('review-session-select');
    const reviewerIdInput = _qs('reviewer-id-input');

    if (openBtn) openBtn.onclick = enterReviewerMode;
    if (closeBtn) closeBtn.onclick = exitReviewerMode;
    if (refreshBtn) refreshBtn.onclick = refreshReviewerSessions;
    if (select) select.onchange = loadSelectedSessionForReview;

    if (reviewerIdInput) {
        reviewerIdInput.addEventListener('input', () => {
            try {
                window.localStorage.setItem('REVIEWER_ID', getReviewerId());
            } catch (_) {}
            syncReviewerIdentityUI();
        });
    }

    syncReviewerIdentityUI();
}

// Hook into app initialization
(function hookReviewerInit() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeReviewerUI);
    } else {
        initializeReviewerUI();
    }
})();
