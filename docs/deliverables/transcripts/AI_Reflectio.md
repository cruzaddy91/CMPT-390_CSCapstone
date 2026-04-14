# CMPT 385 AI Reflection

**Name:** Addy Cruz

---

## November Reflection (Due Friday, November 14, 2025)

*AI tools can be used in many different ways, from simple code completion to full feature generation. Describe your current usage pattern, on a spectrum from "barely used AI" to "heavily relied on AI." Provide at least one specific example of how you're using (or not using) AI tools.*

**Your Response**

I use AI in the middle of that spectrum: I rely on it for brainstorming, design choices, and learning new frameworks, but I still write and debug most of the code myself and verify everything. For example, at the start of the capstone I used an AI assistant to generate five distinct architecture options for the weightlifting platform (React vs Vue, Django REST vs Node, single backend vs separate analytics service, etc.) with pros and cons for each. That gave me a clear set of alternatives to compare instead of picking one stack in a vacuum. I chose React, Django REST Framework, and a hybrid relational plus event log design based on that discussion, but the final decisions were mine.

---

*Describe how you plan to use (or have used) AI tools to assist with developing your Proof of Concept. What tasks do you plan to delegate to AI for example, code generation, debugging, learning new frameworks, architecture decisions?*

**Your Response (bullet list)**

- **Architecture and design:** Using AI to explore architecture options, data model design for example, relational core vs event log, TrainingEvent vs AttemptEvent, and deployment strategies.
- **Learning frameworks:** Asking for explanations and examples for Django REST Framework, React, JWT auth, and Chart.js so I can implement features myself.
- **Code generation:** Using AI for boilerplate for example, API endpoint structure, React component skeletons, migration patterns, and then editing and integrating the code.
- **Debugging:** Describing errors or unexpected behavior and using AI suggestions as a starting point; I still trace through the code and test fixes myself.
- **Documentation and writing:** Drafting proof of concept summaries, proposal wording, and report sections, then revising for accuracy and style.

---

## December Reflection (Due Friday, December 12, 2025)

*Compare your original plan (from November) to what happened. What, if anything, changed?*

**Your Response**

The plan held up overall. I used AI for architecture options and data modeling as intended, and those conversations led directly to the stack (React, Django REST, PostgreSQL) and the hybrid data model (relational tables for athletes/programs, event log tables for TrainingEvent and AttemptEvent). One change: I initially thought I might use AI more for full feature generation, but in practice I used it more for design and small code snippets. I still did most of the Proof of Concept implementation myself (API setup, auth, migrations, charts) and used AI to understand patterns and fix specific issues rather than to generate whole features.

---

*In what area(s) did AI tools work well? Provide details to support your answer.*

**Your Response**

AI worked well in three areas:

1. **Architecture and options.** When I asked for five ways to structure the system, the AI gave clear options (single backend, separate analytics service, server-rendered app, API-first for mobile, event-sourced) with pros and cons. That made it easier to choose a direction and explain it in the proposal.
2. **Data model design.** In a follow-up conversation I asked how to structure training events vs relational tables and whether competition attempts should be stored differently. The AI suggested the hybrid approach (relational core plus event log) and separate AttemptEvent vs TrainingEvent tables with good reasoning. I adopted that design.
3. **Learning and patterns.** For Django REST, JWT auth, React hooks, and Chart.js, asking for explanations and small examples was faster than digging through long docs. I could then implement and adapt the ideas in my own code.

---

*In what area(s) did AI tools **not** work well? Provide details to support your answer.*

**Your Response**

AI was less reliable in two areas:

1. **Project-specific and environment details.** Sometimes the AI suggested code or config that didn’t match my exact setup for example, Django version, React router, or Netlify/Render. I had to double-check versions, CORS, and deployment steps myself. For capstone-specific choices for example, Sinclair calculator or competition timing rules, the AI gave generic answers that I had to refine.
2. **End-to-end correctness.** Generated snippets often needed fixes: wrong import paths, outdated API usage, or missing error handling. I learned to treat AI output as a draft and always run and test the code rather than paste it in and assume it works.

---

*What is the single most important thing you've learned so far, regarding using AI tools for scoping, planning, and building technical projects?*

**Your Response**

The most important thing I learned is to use AI for options and structure, but to own the final decisions and verification. AI is good at generating alternatives (architectures, data models, code patterns) and explaining tradeoffs. It is not a substitute for reading the docs, running the code, and testing. So I use it to speed up design and learning, and I always validate the output before committing to it in the project.

---

*What is your plan for using AI tools in CMPT 390?*

**Your Response (can be a bulleted list or a table)**

- Continue using AI for **architecture and design** discussions when tackling new features or refactors.
- Use AI for **learning and snippets** for example, new libraries, testing patterns, while still reading official documentation for anything critical.
- Use AI to **draft reports and documentation**, then revise for accuracy and to match course style for example, no em dashes, consistent terminology.
- Keep **short transcripts or notes** of key AI conversations (as with the architecture and data modeling discussions) so I can reference and cite them in reflections or reports.
- **Verify all code and config** myself: run tests, check deployment, and never submit generated code without understanding and testing it.
