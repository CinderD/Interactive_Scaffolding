// ==========================================
// PRESET QUESTIONS (Based on Self-Explanation Training)
// ==========================================
const PRESET_QUESTIONS = [
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

// ==========================================
// QUIZ DATA
// ==========================================
const QUIZ_DATA = [
    {
        id: 1,
        q: "According to the proof, which of the following would be the first possible value for M?",
        opts: [
            "M = 87.",
            "M = 135.",
            "M = 311."
        ],
        ans: 2
    },
    {
        id: 2,
        q: "In line (L7), why does the proof show that 2 does not divide M?",
        opts: [
            "Because 2 is neither monadic nor triadic but is a prime so it needs to be shown not to divide M for M to be monadic.",
            "Because 2 can also be considered as a triadic prime so for M to be monadic we must show that all triadic primes do not divide M.",
            "Because 2 is the only even prime number so if 2 does not divide M then no even number will divide M."
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
        q: "Using the method of the proof you have been working with, which of the following would be an appropriate M to use if you were trying to prove there were infinitely many primes of the form 6k + 5?",
        opts: [
            "M = 4p₂...pₙ + 5 where p₁ = 5.",
            "M = 6p₂...pₙ + 5 where p₁ = 6.",
            "M = 6p₂...pₙ + 5 where p₁ = 5."
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
            "The proof assumes there are infinitely many triadic primes and uses them to construct a triadic number M that has only monadic prime factors, which would imply M is also monadic. M cannot be monadic as M is triadic.",
            "The proof lets M = 4p₂...pₙ + 3, where pᵢ are prime numbers and pᵢ does not equal 3. Thus, 2 does not divide M because M is odd. Further, pᵢ does not divide M because it leaves a remainder of 3.",
            "The proof introduces monadic primes to be used later on in the proof. It lets M = 4p₂...pₙ + 3 and shows 2 does not divide M, since 2 is even and M is odd. However, this would not itself create an infinite triadic prime so the proof uses monadic primes to create an infinite triadic prime."
        ],
        ans: 0
    },
    {
        id: 9,
        q: "Can we conclude from this proof that the product of two triadic primes is itself triadic?",
        opts: [
            "No - the proof only shows the product of two monadic numbers is monadic.",
            "Yes - triadic and monadic primes are closely linked, as shown in the proof, so we are allowed to assume that the product of two triadic primes is triadic.",
            "Yes - this is used in the proof because M is a triadic number and this can only occur if the product of triadic primes is triadic."
        ],
        ans: 0
    },
    {
        id: 10,
        q: "Why does the proof include the sub-proof that the product of monadic numbers is monadic?",
        opts: [
            "Because in line (L4) we have a product of monadic numbers so M itself needs to be shown as monadic.",
            "Because by showing that the product of monadic numbers is monadic we can then assume the product of triadic numbers is triadic.",
            "Because the proof uses it in line (L8) to show that M is in fact monadic leading to a contradiction."
        ],
        ans: 2
    }
];

