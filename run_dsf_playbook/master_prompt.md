This Tactical Playbook will be the master guide for all project execution. It defines the roles, processes, and hand-offs that will enable our 80/20 automation goal. Here is the official draft of the playbook.
The 371 Minds Tactical Playbook: Integrating Discover, Space, Flow with the ModuMind (BMAD) Agent Framework
Purpose: This document outlines the official, standardized workflow for taking any project from initial concept to a launched, operational, and continuously improving product. It serves as the single source of truth for project execution within the 371 Minds ecosystem.
Phase 1: Discover (The "Why" and "What")
Goal: To deeply understand the problem space, validate the core idea, define the scope of a Minimum Viable Product (MVP), and produce a detailed, actionable plan.

Step	Objective	Lead Agent	Inputs	Key Activities	Deliverable(s)	Hand-off To
1.1	Ideation & Briefing	Analyst (Mary)	User's initial idea/concept.	Execute "Project Briefing" mode, using the project-brief-tmpl.txt to guide the user from a high-level idea to a structured brief.	A completed Project Brief.	Product Manager (John)
1.2	Requirements & Planning	Product Manager (John)	The signed-off Project Brief.	Execute the create-prd task to transform the brief into a detailed PRD with Epics and high-level User Stories. Validate the PRD against the pm-checklist.	A comprehensive Product Requirements Document (PRD).	SPACE Bot (Kimberly)
Phase 2: Space (The "How")
Goal: To create the "Collaboration Playbook" by designing the complete technical and user experience architecture, ensuring all plans are aligned and ready for implementation.

Step	Objective	Lead Agent(s)	Inputs	Key Activities	Deliverable(s)	Hand-off To
2.1	Orchestration & Setup	SPACE Bot (Kimberly)	The PRD.	Execute the "Tactical Playbook Composition" task to structure the architectural phase and prepare the "collaboration space" (e.g., setting up docs folders, creating the index.md for project documents).	A structured Project Workspace.	Architects
2.2	System & UI/UX Architecture	Architect (Fred) & Design Architect (Jane)	The PRD and Project Workspace.	Fred executes the create-architecture task. Jane executes the create-uxui-spec and create-frontend-architecture tasks. They work in parallel to design the complete technical solution.	Architecture Document, UI/UX Specification, Frontend Architecture Document.	Product Owner (Sarah)
2.3	Final Plan Validation	Product Owner (Sarah)	All previously created documents (Brief, PRD, Architecture docs).	Execute the checklist-run-task using the po-master-checklist to ensure all documents are complete, consistent, and logically sequenced.	An "Approved MVP Plan".	FLOW Bot (Louis)
Phase 3: Flow (The "Build and Improve")
Goal: To manage the continuous cycle of building, testing, deploying, and optimizing the product, embodying the 80/20 automation principle.

Step	Objective	Lead Agent(s)	Inputs	Key Activities	Deliverable(s)	Hand-off To
3.1	Backlog & Story Generation	FLOW Bot (Louis) coordinating Scrum Master (Bob)	The Approved MVP Plan and Epics.	The FLOW Bot prioritizes work. The SM executes the story-draft-task to create detailed, actionable stories from the Epics, validating them against the story-draft-checklist.	A "Ready-to-Build" User Story.	Developer Agents
3.2	Implementation & Development	Developer Agents	A single "Ready-to-Build" User Story.	Write and test the code to implement the story's requirements, adhering to all architectural documents and coding standards.	Completed, Tested Code for the story.	Scrum Master (Bob) for review against the story-dod-checklist.
3.3	Continuous Improvement	FLOW Bot (Louis) & Yourself	Completed stories, user feedback, and analytics from PostHog.	The FLOW Bot executes "Lessons Learned & Knowledge Capture" and "Process Improvement Recommendations." You provide the 20% human oversight, review the "Flow Dashboard," and guide the overall strategy.	An Updated Tactical Playbook and a smarter, more efficient system.	This is a continuous loop.