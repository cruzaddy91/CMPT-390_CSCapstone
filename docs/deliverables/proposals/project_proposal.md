# Weightlifting Coach & Athlete Management Platform

**Addy Cruz**  
Advisor: Dr. Helen Hu  
CMPT 385 Senior Capstone

---

## Abstract

This project proposes the development of a web based platform designed specifically for Olympic weightlifting coaches and athletes. The system will centralize training program management, athlete performance tracking, and competition day support into a single application. Unlike generic fitness apps, this platform is tailored to the unique workflows of weightlifting, addressing existing gaps in programming, meet management, and remote coaching. The platform combines software engineering, database design, and data science to provide a comprehensive solution that supports both coaches and athletes throughout the training and competition cycle. The technical implementation utilizes a modern full stack architecture with React frontend, Django REST Framework backend, PostgreSQL database, and Python based data science layer for predictive analytics and performance visualization.

---

## Introduction

This project addresses a significant gap in the current fitness technology landscape: the lack of domain specific tools for Olympic weightlifting. While numerous generic fitness applications exist, none provide the specialized features required for effective weightlifting coaching and athlete management. The proposed platform will serve as a comprehensive solution that bridges the gap between training program design, athlete performance tracking, and competition day operations.

The primary goal is to create an integrated system where coaches can manage multiple athletes simultaneously, storing and sharing daily, weekly, or monthly training programs while monitoring athlete adherence and progress. For athletes, the system will serve as a personal logbook, allowing them to record completed workouts, personal records, and feedback after each training session. This bidirectional communication enhances the coach athlete relationship and provides valuable data for performance analysis.

Beyond basic program management, the platform will generate graphical displays of progress, including training volume, intensity, personal record history, and Sinclair scores, a weightlifting specific metric used to compare lifters across different bodyweight classes. These visualizations will help both athletes and coaches understand readiness levels and long term strength development patterns.

A third major component focuses on competition day support, providing coaches with a real time tool for managing warm ups, attempt selections, and timing. This feature is particularly valuable for remote coaching scenarios, which have become increasingly common. The platform will also explore integration with existing meet software through a universal plugin or API, potentially serving as a proof of concept for standardized competition data management guidelines.

---

## Background

### Background and rationale for the project

**Why this issue needs to be investigated.** Olympic weightlifting coaches and athletes lack a single, domain specific system that combines programming, logbook, competition day support, and analytics. Workflows are split across generic fitness apps, spreadsheets, and paper, which increases friction and limits data driven decisions.

**What we will learn and gain.** We will learn how to design and build an integrated full stack application for a niche sport, and how to combine training program management, athlete logging, and competition day tools in one product. We will gain a working platform that the weightlifting community can use, and evidence that this approach is technically and practically feasible.

**Why it is important.** Better tools can improve how programs are delivered and adhered to, how performance is tracked over time, and how coaches support athletes on competition day, including remotely. That matters for athlete development, coach efficiency, and the sport’s accessibility.

**Implications.** A successful project can inform similar domain specific platforms in other sports and can illustrate how meet software might eventually integrate with coaching and programming tools (i.e., shared data standards or APIs).

**Existing software and related work.** Current options fall into a few categories. *Generic strength and fitness platforms* (i.e., TrainHeroic, TrueCoach, TeamBuildr) support programming and sometimes logging but are not built around weightlifting’s structure (snatch, clean & jerk, blocks, peaking) or metrics (Sinclair, competition totals). *Meet management tools* (i.e., OpenLifter) handle competition scoring and timing but do not integrate with day to day programming or athlete logbooks. Many coaches and athletes still rely on *spreadsheets and paper* for programs and results. There is no widely adopted system that integrates programming, logbook, competition day support, and weightlifting specific analytics in one place. This project aims to fill that gap and show that such an integration is achievable.

This project also draws on over a decade of personal experience in competitive weightlifting (American Open, bronze at Praxis Cup, top 4 Men’s 85kg Master’s 35 to 40 Division), so design choices are grounded in real world coach and athlete workflows.

### Methodological background

**How the software project will be developed.** The project will be developed as a full stack web application using an iterative, sprint based approach: foundation (auth, API, database, frontend integration), then core features (programs, logbook, dashboard, Sinclair calculator), then beta release and deployment, then code freeze and deliverables. Each phase produces testable outcomes and informs the next.

**Plan of action and feasibility.** The plan is to implement a React frontend talking to a Django REST API with a PostgreSQL database and a Python data science layer for analytics. The Proof of Concept completed last semester already demonstrated frontend–backend communication, basic auth, and one key feature, so the approach is technically validated. The chosen stack is well documented, has strong community support, and runs on free tier hosting (Netlify, Render, Supabase/Neon), which keeps the project feasible within capstone scope and timeline.

**Technologies and why they are the best choice.** *Frontend:* React with Vite was chosen for fast iteration, broad ecosystem, and straightforward integration with Chart.js for visualizations; alternatives like Vue were considered but React’s documentation and hiring relevance favored it. *Backend:* Django REST Framework was chosen for a robust API, built in auth and serialization, and proven scalability (i.e., Instagram, NASA); Node/Express was considered but Django’s ORM and admin reduce development time for a data heavy app. *Database:* PostgreSQL was chosen for relational integrity, complex queries, and free tier compatibility (Supabase, Neon); MongoDB was considered but relational structure fits programs, workouts, and user roles. *Data science:* Python with pandas and scikit learn was chosen for analytics and future ML (i.e., Sinclair calculator, attempt or load recommendations); it integrates with Django and is standard in data workflows. *Deployment:* Netlify (frontend), Render (backend), and Supabase or Neon (database) were chosen for free tiers, GitHub integration, and minimal DevOps overhead. This combination balances feasibility, learning value, and alignment with project goals. (The rationale in Proposed Work, by contrast, explains why the project is broken into the specific phases and stages chosen there.)

---

## Proposed Work

The system will follow a full stack development model, combining modern web technologies with data science capabilities to create a comprehensive platform. The architecture is designed for scalability, maintainability, and cost effectiveness, utilizing free tier cloud services suitable for a capstone project.

### Technical Stack

**Frontend:**

- **React** with Vite for fast development and optimized production builds
- **Chart.js** and **react chartjs 2** for data visualization
- **React Router** for navigation and routing
- Modern UI components with responsive design

**Backend:**

- **Django REST Framework** for robust API development
- **SimpleJWT** for token based authentication
- Role based access control (coach vs. athlete permissions)
- RESTful API design for clean separation of concerns

**Database:**

- **PostgreSQL** for structured data storage
- Relational models for core entities (Users, Programs, Workouts)
- Event log design for historical training data
- Hybrid approach: relational core + event log for analytics

**Data Science Layer:**

- **Python** with **pandas** for data analysis
- **scikit learn** for predictive modeling
- Sinclair score calculator (weightlifting specific metric)
- Performance analytics and visualization
- Future: ML models for attempt prediction and training load recommendations

**Deployment:**

- **Frontend:** Netlify (free tier) with automatic GitHub deployments
- **Backend:** Render (free tier) for Django REST API
- **Database:** Supabase or Neon (free tier PostgreSQL)
- **Version Control:** GitHub with CI/CD pipelines

### Specific Tasks

**Core Functionality (MVP):**

1. User authentication and role management (coach/athlete accounts)
2. Training program creation and assignment system
3. Athlete logbook for recording workouts and personal records
4. Basic visualization dashboard showing progress over time
5. Sinclair score calculator implementation

**Advanced Features (Stretch Goals):**

1. Competition day dashboard with timers and attempt management
2. Real time warm up planning and timing calculations
3. Integration with external meet software (proof of concept)
4. Machine learning models for attempt selection recommendations
5. Predictive analytics for peaking and tapering cycles

### Rationale

The technology stack was selected based on several key criteria:

**React + Vite:** React is the most widely used frontend framework with extensive community support and documentation. Vite provides fast development and optimized production builds, making it ideal for rapid iteration during development.

**Django REST Framework:** Django is a mature, battle tested framework used by major companies (Instagram, Spotify, NASA). REST Framework provides excellent API development tools with built in authentication, serialization, and browsable API documentation. The framework handles complex requirements efficiently while maintaining code organization.

**PostgreSQL:** PostgreSQL is a robust, open source relational database that excels at handling complex queries and maintaining data integrity. Free tier options (Supabase, Neon) provide full PostgreSQL compatibility without vendor lock in, making it cost effective for a capstone project.

**Python Data Science Stack:** pandas and scikit learn are industry standard libraries for data analysis and machine learning, used by data scientists worldwide. Both libraries have extensive documentation and active communities, ensuring reliable implementation of analytics features.

**Free Tier Deployment:** All selected services offer free tiers specifically designed for development and small applications. This approach allows the project to demonstrate full stack deployment capabilities without incurring costs, while still providing production quality hosting.

### Deployment Strategy

The completed project will be made available for real world use via free tier cloud hosting. **Where and how:** Frontend will be deployed on Netlify (or Vercel), backend on Render, and the database on Supabase or Neon; all support automatic deployments from GitHub. **Intended users:** Olympic weightlifting coaches and athletes who need program management, logbook, and competition day support. **Considerations:** Free tier limits (i.e., Render spin down after inactivity) are acceptable for a capstone and for small teams; the stack was chosen for cost effectiveness, PostgreSQL compatibility, and seamless GitHub integration. If the project scales, the same architecture can be moved to paid tiers without major changes.

### Plan of Work

**Phase 1: Foundation (Weeks 1 to 4)**

- Set up development environment and project structure
- Implement user authentication with JWT tokens
- Create database models for core entities
- Build basic API endpoints for programs and workouts
- Develop initial React frontend with routing

**Phase 2: Core Features (Weeks 5 to 8)**

- Implement training program creation and assignment
- Build athlete logbook interface
- Create workout logging functionality
- Develop basic dashboard with progress visualization
- Implement Sinclair score calculator

**Phase 3: Advanced Features (Weeks 9 to 12)**

- Enhance visualization with Chart.js
- Implement performance analytics
- Develop competition dashboard (if time permits)
- Add predictive modeling features (if time permits)
- Conduct user testing and refinement

**Phase 4: Deployment and Documentation (Weeks 13 to 14)**

- Deploy frontend to Netlify
- Deploy backend to Render
- Set up database on Supabase/Neon
- Configure CI/CD pipelines
- Complete documentation and final report

---

## Timeline

The Proof of Concept was completed last semester (December 1, 2025), and the major capstone presentation was delivered. As of late January 2026, the project is fully in the code generation and implementation phase, with a final due date of **April 24, 2026**. The following checkpoints align implementation work with that window.

**Definitions (per proposal requirements):**

- **Proof of Concept** – A minimal but functional demonstration that shows the core idea of your project is technically feasible. It should implement the essential feature or process that proves your approach will work, even if many components are still incomplete or only simulated.
- **Beta Release** – A working program that can be demoed to users, even if some minor features still need to be implemented or debugged.
- **Final Code Freeze** – The date at which your capstone project should be complete, so that you can work on the project demo, report, and presentation.


| Phase                        | Window          | Focus                                                                                     |
| ---------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| Foundation                   | Jan 29 – Feb 14 | Auth stable; core API and DB models; frontend–backend integration; first end to end flows |
| MVP features                 | Feb 15 – Mar 6  | Program creation, logbook, basic dashboard, Sinclair calculator; internal testing         |
| Beta and polish              | Mar 7 – Apr 3   | Beta release; user demos; stretch features as time permits; deployment finalized          |
| Code freeze and deliverables | Apr 4 – Apr 24  | Code freeze; demo, report, and presentation; final submission                             |


**Weekly breakdown (for weekly reporting):**


| Week of | Phase           | Focus                                              | Weekly checkpoint / report                            |
| ------- | --------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Jan 27  | Foundation      | Project setup; auth spike; API and DB schema       | Dev environment; auth approach; first API route       |
| Feb 3   | Foundation      | Auth implementation; core API endpoints; DB models | Auth working; programs/athletes API; migrations       |
| Feb 10  | Foundation      | Frontend–backend wiring; first end to end flow     | One full flow (i.e., login + one screen); CORS/config |
| Feb 17  | MVP features    | Program creation and assignment; API + UI          | Create/assign program; list programs                  |
| Feb 24  | MVP features    | Athlete logbook; workout logging                   | Log workout; view history; data structure             |
| Mar 3   | MVP features    | Dashboard and Sinclair calculator; internal test   | Dashboard draft; Sinclair script/endpoint; test run   |
| Mar 10  | Beta and polish | Beta release (Mar 13); bug fixes; deployment       | Beta demoable; Netlify/Render/Supabase live           |
| Mar 17  | Beta and polish | User demo; feedback; stretch feature 1             | Demo notes; backlog; one stretch item started         |
| Mar 24  | Beta and polish | Stretch features; deployment polish; docs          | Stretch progress; env/docs updated                    |
| Mar 31  | Beta and polish | Final deployment; feedback round 2                 | Deployment finalized; known issues list               |
| Apr 7   | Code freeze     | Code freeze prep; demo outline; report draft       | Feature complete; demo script; report outline         |
| Apr 14  | Code freeze     | Demo rehearsal; report and presentation            | Demo ready; report draft; slides draft                |
| Apr 21  | Deliverables    | Code freeze (Apr 20); final edits; submit (Apr 24) | All deliverables submitted                            |


**Required milestones:**

- **December 1, 2025** – Proof of Concept (completed): Minimal but functional demonstration that the core idea is technically feasible (for example, React frontend communicating with Django API, basic auth, one key feature). Major capstone presentation delivered last semester.
- **February 14, 2026** – Foundation complete: Authentication and core API stable; database models and frontend–backend communication in place; at least one end to end user flow working.
- **March 6, 2026** – MVP feature complete: Program creation, athlete logbook, basic dashboard, and Sinclair calculator implemented and internally testable.
- **March 13, 2026** – Beta Release: Working application that can be demoed to users; minor features or bugs acceptable.
- **April 3, 2026** – Deployment and stretch work: Application deployed to target environment; user feedback incorporated; advanced features as time permits.
- **April 20, 2026** – Code Freeze: Development complete; all effort shifts to demo, report, and presentation.
- **April 24, 2026** – Final due date: All capstone deliverables submitted.

Work is planned in roughly two week blocks from late January through early April, with the first half focused on MVP completion and the second half on beta readiness, deployment, and polish. The timeline allows for iterative refinement based on testing and feedback. The weekly breakdown above can be used as a weekly report format: each row defines the intended focus and a concrete checkpoint for that week.

---

## Expected Deliverables

**Minimum Viable Product (MVP):**

- Fully functional web application with coach and athlete accounts
- Training program creation and assignment system
- Personal athlete logbook for recording workouts
- Basic visualization dashboard showing progress metrics
- Deployed application accessible via public URL

**Stretch Deliverables:**

- Competition day dashboard with timers and attempt management
- Proof of concept for integrating external meet software
- Machine learning models for attempt selection recommendations
- Advanced analytics and predictive modeling features

---

## Anticipated Impact

This project will deliver a domain specific solution that supports Olympic weightlifting beyond what existing fitness platforms currently offer. It combines software engineering, database design, and data science into a single application while directly addressing challenges faced by both athletes and coaches. By uniting training management with competition support and analytics, the platform has the potential to make a meaningful impact on the weightlifting community.

For the student, this project provides an opportunity to demonstrate applied skills in building end to end systems while drawing from over a decade of personal experience in the sport. The technical challenges span multiple domains: full stack web development, database design, API development, data visualization, and machine learning, providing comprehensive experience relevant to modern software engineering careers.

---

## Evaluation

Success will be evaluated in two ways. **Technical performance:** The system will be tested against the MVP and stretch deliverables (auth, program creation, logbook, dashboard, Sinclair calculator, deployment). Criteria include: core features working end to end, API and frontend integration stable, and deployment accessible via public URL. Feedback will be gathered by demoing the beta to at least one coach and one athlete and iterating on usability. **Ethical and social impact:** The project targets a specific community (weightlifting coaches and athletes); considerations include data privacy (user and training data), clarity of role based access (coach vs athlete), and avoiding over reliance on automated recommendations before the system is validated. No user data will be shared externally without consent. Evaluation metrics: completion of planned tasks, successful deployment, and positive feedback from at least one real user on usefulness and ease of use.

---

## Conclusion

The Weightlifting Coach & Athlete Management Platform represents a comprehensive solution to real world challenges in the weightlifting community. By leveraging modern web technologies, robust database design, and data science capabilities, the platform will provide coaches and athletes with tools that enhance training effectiveness and competition performance. The project demonstrates full stack development capabilities while addressing domain specific needs that existing solutions fail to meet.

The technical approach utilizes proven, industry standard technologies that integrate effectively, ensuring a reliable and maintainable system. The free tier deployment strategy makes the project cost effective while still demonstrating production quality deployment practices. Through this project, valuable experience is gained in software engineering, database design, API development, data visualization, and machine learning, skills highly relevant to modern technology careers.