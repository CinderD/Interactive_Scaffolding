// ==========================================
// STUDY MATERIALS (Proofs + Questions + Quiz)
// ==========================================

const PRESET_QUESTIONS_A = [
    {
        id: 1,
        text: "What does 'monadic' mean in this proof?",
        scaffoldType: "explaining"
    },
    {
        id: 2,
        text: "What does 'triadic' mean?",
        scaffoldType: "explaining"
    },
    {
        id: 3,
        text: "Why does the proof show that (4j+1)(4k+1) expands to 16jk + 4j + 4k + 1?",
        scaffoldType: "hinting"
    },
    {
        id: 4,
        text: "How does the idea of 'product of monadic numbers' link to the rest of the proof?",
        scaffoldType: "instructing"
    },
    {
        id: 5,
        text: "Why does the proof assume there are only finitely many triadic primes?",
        scaffoldType: "hinting"
    },
    {
        id: 6,
        text: "Why do p₂, p₃, ..., pₙ not divide M?",
        scaffoldType: "hinting"
    },
    {
        id: 7,
        text: "Why does the proof mention that 3 does not divide M?",
        scaffoldType: "hinting"
    },
    {
        id: 8,
        text: "Why does the proof state that 2 does not divide M?",
        scaffoldType: "explaining"
    },
    {
        id: 9,
        text: "How does the proof conclude that M must be monadic?",
        scaffoldType: "instructing"
    },
    {
        id: 10,
        text: "What is the contradiction that completes the proof?",
        scaffoldType: "instructing"
    },
    {
        id: 11,
        text: "Can you give me an example of a triadic number?",
        scaffoldType: "modeling"
    },
    {
        id: 12,
        text: "What is the logical sequence of steps in this proof?",
        scaffoldType: "instructing"
    }
];

const PRESET_QUESTIONS_C = [
    { id: 1, text: "What does \"p divides (4n^2+1)\" mean here?", scaffoldType: "explaining" },
    { id: 2, text: "Why is it enough to rule out p = 2 and p \u2261 3 (mod 4)?", scaffoldType: "hinting" },
    { id: 3, text: "What is the role of the substitution y = 2n?", scaffoldType: "instructing" },
    { id: 4, text: "How do we go from y^2 + 1 \u2261 0 (mod p) to y^2 \u2261 -1 (mod p)?", scaffoldType: "explaining" },
    { id: 5, text: "Where exactly is Fermat's Little Theorem used?", scaffoldType: "hinting" },
    { id: 6, text: "Why does assuming p = 4k + 3 create a contradiction?", scaffoldType: "instructing" },
    { id: 7, text: "How does the exponent p-1 become 4k+2 under the assumption p=4k+3?", scaffoldType: "hinting" },
    { id: 8, text: "Why is (-1)^{2k+1} = -1?", scaffoldType: "explaining" },
    { id: 9, text: "Can you summarize the proof strategy in 2-3 steps?", scaffoldType: "instructing" },
    { id: 10, text: "What is the precise contradiction at the end?", scaffoldType: "instructing" },
    { id: 11, text: "Can you give a small numeric example to illustrate congruence mod p?", scaffoldType: "modeling" },
    { id: 12, text: "What do the line labels (L1)-(L6) correspond to in the argument?", scaffoldType: "explaining" },
];

const QUIZ_DATA_A = [
    {
        id: 1,
        q: "According to the proof, which of the following would be the first possible value for \\(M\\)?",
        opts: [
            "\\(M = 87\\).",
            "\\(M = 135\\).",
            "\\(M = 311\\)."
        ],
        ans: 2
    },
    {
        id: 2,
        q: "In line (L7), why does the proof show that \\(2 \\nmid M\\)?",
        opts: [
            "Because 2 is neither monadic nor triadic but is a prime so it needs to be shown that \\(2 \\nmid M\\) for \\(M\\) to be monadic.",
            "Because 2 can also be considered as a triadic prime so for \\(M\\) to be monadic we must show that all triadic primes do not divide \\(M\\).",
            "Because 2 is the only even prime number so if \\(2 \\nmid M\\) then no even number will divide \\(M\\)."
        ],
        ans: 0
    },
    {
        id: 3,
        q: "Which of the following best defines a prime number?",
        opts: [
            "Any real number that is greater than 0 and is only divisible by 1 and itself.",
            "Any positive integer that is only divisible by 1 and itself.",
            "Any positive integer that is greater than 1 that is only divisible by 1 and itself."
        ],
        ans: 2
    },
    {
        id: 4,
        q: "Which of the following best describes the logical relation between lines (L2) and (L8)?",
        opts: [
            "The lines are logically independent.",
            "(L2) logically depends on statements made in line (L8).",
            "(L8) logically depends on statements made in line (L2)."
        ],
        ans: 2
    },
    {
        id: 5,
        q: "Which of the following best describes the logical relation between lines (L5) and (L6)?",
        opts: [
            "The lines are logically independent.",
            "(L5) logically depends on statements made in line (L6).",
            "(L6) logically depends on statements made in line (L5)."
        ],
        ans: 2
    },
    {
        id: 6,
        q: "Using the method of the proof you have been working with, which of the following would be an appropriate \\(M\\) to use if you were trying to prove there were infinitely many primes of the form \\(6k + 5\\)?",
        opts: [
            "\\(M = 4p_2\\cdots p_n + 5\\) where \\(p_1 = 5\\).",
            "\\(M = 6p_2\\cdots p_n + 5\\) where \\(p_1 = 6\\).",
            "\\(M = 6p_2\\cdots p_n + 5\\) where \\(p_1 = 5\\)."
        ],
        ans: 2
    },
    {
        id: 7,
        q: "What type of proof is this?",
        opts: [
            "Proof by contradiction.",
            "Proof by contraposition.",
            "Proof by induction."
        ],
        ans: 0
    },
    {
        id: 8,
        q: "Which of the following summaries best capture the ideas of the proof?",
        opts: [
            "The proof assumes there are infinitely many triadic primes and uses them to construct a triadic number \\(M\\) that has only monadic prime factors, which would imply \\(M\\) is also monadic. \\(M\\) cannot be monadic as \\(M\\) is triadic.",
            "The proof lets \\(M = 4p_2\\cdots p_n + 3\\), where \\(p_i\\) are prime numbers and \\(p_i\\) does not equal 3. Thus, \\(2 \\nmid M\\) because \\(M\\) is odd. Further, \\(p_i\\) does not divide \\(M\\) because it leaves a remainder of 3.",
            "The proof introduces monadic primes to be used later on in the proof. It lets \\(M = 4p_2\\cdots p_n + 3\\) and shows \\(2 \\nmid M\\), since 2 is even and \\(M\\) is odd. However, this would not itself create an infinite triadic prime so the proof uses monadic primes to create an infinite triadic prime."
        ],
        ans: 0
    },
    {
        id: 9,
        q: "Can we conclude from this proof that the product of two triadic primes is itself triadic?",
        opts: [
            "No - the proof only shows the product of two monadic numbers is monadic.",
            "Yes - triadic and monadic primes are closely linked, as shown in the proof, so we are allowed to assume that the product of two triadic primes is triadic.",
            "Yes - this is used in the proof because \\(M\\) is a triadic number and this can only occur if the product of triadic primes is triadic."
        ],
        ans: 0
    },
    {
        id: 10,
        q: "Why does the proof include the sub-proof that the product of monadic numbers is monadic?",
        opts: [
            "Because in line (L4) we have a product of monadic numbers so \\(M\\) itself needs to be shown as monadic.",
            "Because by showing that the product of monadic numbers is monadic we can then assume the product of triadic numbers is triadic.",
            "Because the proof uses it in line (L8) to show that \\(M\\) is in fact monadic leading to a contradiction."
        ],
        ans: 2
    }
];

const QUIZ_DATA_C = [
    {
        id: 1,
        q: "Which of the following best defines the symbol \\(\\equiv\\) in this proof?",
        opts: ["Equivalent to.", "Congruent to.", "Equal to."],
        ans: 1,
    },
    {
        id: 2,
        q: "Which justification best explains why p cannot be 2?",
        opts: [
            "Because 2 divides into 4 so you cannot have \\(p \\equiv 2\\ (\\mathrm{mod}\\ 4)\\).",
            "Because \\(2\\ (\\mathrm{mod}\\ 4) = (-1)\\ (\\mathrm{mod}\\ p)\\) which is shown later in the proof.",
            "Because \\(4n^2 + 1\\) is odd so 2 does not divide into it.",
        ],
        ans: 2,
    },
    {
        id: 3,
        q: "Which justification best explains why \\(y^2 + 1 \\equiv 0\\)?",
        opts: [
            "Because \\(y^2 + 1\\) is divisible by \\(n\\).",
            "Because \\(y^2 + 1 = (2n)^2 + 1 = 4n^2 + 1\\).",
            "Because \\(p\\) does not divide \\(n\\) so \\(y^2 + 1 \\equiv 0\\ (\\mathrm{mod}\\ p)\\).",
        ],
        ans: 1,
    },
    {
        id: 4,
        q: "Which of the following best describes the logical relation between lines (L1) and (L2)?",
        opts: [
            "The lines are logically independent.",
            "(L1) logically depends on statements made in line (L2).",
            "(L2) logically depends on statements made in line (L1).",
        ],
        ans: 2,
    },
    {
        id: 5,
        q: "Which of the following best describes the logical relation between lines (L4), (L5) and (L6)?",
        opts: [
            "The lines are logically independent.",
            "(L6) logically depends on statements made in both lines (L4) and (L5).",
            "(L6) logically depends on statements made in line (L5) and is independent to statements made in line (L4).",
        ],
        ans: 1,
    },
    {
        id: 6,
        q: "Which of the following best explains why showing that \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\) proves the theorem?",
        opts: [
            "3 is the first odd prime number. Therefore, if \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\), it had to be \\(1\\ (\\mathrm{mod}\\ 4)\\) because primes are only divisible by themselves and 1.",
            "Prime numbers are either monadic (1 mod 4), triadic (3 mod 4) or 2. Since \\(p\\) cannot be 2, by showing it cannot be triadic it has to be monadic.",
            "\\(3\\ (\\mathrm{mod}\\ 4) = (-1)\\ (\\mathrm{mod}\\ 4)\\). Therefore, if \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\), \\(p \\not\\equiv (-1)\\ (\\mathrm{mod}\\ 4)\\). This means it must be \\(1\\ (\\mathrm{mod}\\ 4)\\) by rules of modular arithmetic.",
        ],
        ans: 1,
    },
    {
        id: 7,
        q: "Which of the following best describes the method of this proof?",
        opts: ["Proof by contradiction.", "Proof by contraposition.", "Proof by example."],
        ans: 0,
    },
    {
        id: 8,
        q: "Which of the following best summarises the proof after line (L3)?",
        opts: [
            "We are told \\(y^2 + 1 \\equiv 0\\ (\\mathrm{mod}\\ p)\\). By doing some substitutions we show \\(y^{p-1} \\equiv (-1)\\ (\\mathrm{mod}\\ p)\\). But this cannot be the case because we know \\(p \\mid (4n^2 + 1)\\) and by Fermat’s Little Theorem, \\(y^{p-1} \\equiv 1\\ (\\mathrm{mod}\\ p)\\). Therefore, we have shown \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\) and proved the theorem.",
            "We are told \\(y^2 + 1 \\equiv 0\\ (\\mathrm{mod}\\ p)\\). We show \\(y^{p-1} \\equiv (-1)\\ (\\mathrm{mod}\\ p)\\) by doing some substitutions. But this cannot be the case because we know \\(y^2 + 1 \\equiv 0\\ (\\mathrm{mod}\\ 4)\\) so \\(y^{p-1} \\equiv (-1)\\ (\\mathrm{mod}\\ p)\\). Therefore, we have proven \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\) and proved the theorem.",
            "We are told \\(y^2 + 1 \\equiv 0\\ (\\mathrm{mod}\\ p)\\). We show \\(y^{p-1} \\equiv (-1)\\ (\\mathrm{mod}\\ p)\\) by using Fermat’s Little Theorem. But this cannot be the case because we know \\(p \\neq 2\\) and \\(y^{4k+2} \\mid 2\\). Therefore, we have proven \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\) and proved the theorem.",
        ],
        ans: 0,
    },
    {
        id: 9,
        q: "Which of the following best explains why we set y = 2n?",
        opts: [
            "Because we know \\(p \\neq 2\\) so if \\(y = 2n\\), \\(p\\) divides \\(y\\) which cannot be the case. Therefore, setting \\(y = 2n\\) helps us to prove \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\).",
            "Because we can use Fermat’s Little Theorem to show \\(y^{p-1} \\equiv 1\\ (\\mathrm{mod}\\ p)\\). This is then used to show \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\) because by modulo arithmetic, \\(y^{p-1} \\equiv 1\\ (\\mathrm{mod}\\ p)\\) implies \\(p \\equiv 1\\ (\\mathrm{mod}\\ 4)\\).",
            "Because we can use Fermat’s Little Theorem to show \\(y^{p-1} \\equiv 1\\ (\\mathrm{mod}\\ p)\\) and because \\(y^2 + 1 = 4n^2 + 1\\), which is divisible by \\(p\\) by the theorem. This then sets up a contradiction which we use to prove \\(p \\not\\equiv 3\\ (\\mathrm{mod}\\ 4)\\).",
        ],
        ans: 2,
    },
    {
        id: 10,
        q: "According to the theorem, is \\(133 \\equiv 1\\ (\\mathrm{mod}\\ 4)\\)?",
        opts: [
            "Yes because \\(p = 133\\) divided by 4 is 33.25 which is \\(1\\ (\\mathrm{mod}\\ 4)\\).",
            "No because \\(p = 133\\) is not prime.",
            "No because \\(p = 133\\) does not divide \\(4n^2 + 1\\) \\(\\forall n \\in \\mathbb{Z}\\).",
        ],
        ans: 1,
    },
];

const STUDY_PROOFS = {
    A: {
        id: 'A',
        name: 'Proof A',
        quizTitleHint: 'Refer to Proof A on the left if needed.',
        presetQuestions: PRESET_QUESTIONS_A,
        quizData: QUIZ_DATA_A,
    },
    C: {
        id: 'C',
        name: 'Proof C',
        quizTitleHint: 'Refer to Proof C on the left if needed.',
        presetQuestions: PRESET_QUESTIONS_C,
        quizData: QUIZ_DATA_C,
    },
};

function getCurrentProofId() {
    return state?.currentProofId || 'A';
}

function getPresetQuestions() {
    const proof = STUDY_PROOFS[getCurrentProofId()] || STUDY_PROOFS.A;
    return proof.presetQuestions;
}

function getQuizData() {
    const proof = STUDY_PROOFS[getCurrentProofId()] || STUDY_PROOFS.A;
    return proof.quizData;
}

function getQuizHintText() {
    const proof = STUDY_PROOFS[getCurrentProofId()] || STUDY_PROOFS.A;
    return proof.quizTitleHint;
}

