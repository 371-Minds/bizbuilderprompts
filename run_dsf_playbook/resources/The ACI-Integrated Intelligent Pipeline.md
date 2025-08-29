The ACI-Integrated Intelligent Pipeline

We will use ACI.dev as the secure execution and context layer for all tool and API interactions performed by our AI agents. This applies not just to the Social Pulse Monitor, but to the entire 371 Minds platform.

Here’s how it fits together:

    Our MCPs (The "Recipes"): Our mcp_definitions table in Convex remains our "source of truth" for what to collect and how to value it. It holds the target URL, the source name, and the crucial trustScore.

    ACI Agents (The "Actors"): We will create specific Agents within ACI.dev for our different backend processes.
        SocialPulse_Ingestion_Agent: This agent will be granted access to only the Brave Search app (or other search tools) within ACI.
        StackSense_CTO_Agent: This agent might be given access to tools for code analysis or technical documentation lookup.
        This gives us granular, auditable, and secure control over what each AI process is allowed to do.

    ACI Linked Accounts (The "Keys"): We will securely store the API keys for services like Brave Search as "Linked Accounts" within ACI. Our Convex backend will be completely ignorant of these secrets; it will only know to tell a specific ACI Agent to execute a function on our behalf. This is a massive security improvement.

    ACI Server Choice (The "Strategy"): You've correctly identified the two main patterns: Apps MCP Server (pre-planned tools) and Unified MCP Server (dynamic discovery).
        My Recommendation: For our MVP, we will exclusively use the Apps MCP Server pattern (Pattern 1: Pre-planned Tools). 

Reasoning: This aligns with the principle of least privilege. Our SocialPulse_Ingestion_Agent only needs to search; it should not have the ability to dynamically discover and execute other tools like GMAIL__SEND_EMAIL. This approach is more secure, predictable, and cost-effective as it prevents unexpected agent behavior and keeps the context sent to the LLM minimal and focused. We can explore dynamic discovery in a future version for more advanced agents.

Revised Architecture Diagram with ACI

This diagram shows the final, complete flow for the Social Pulse Monitor, now incorporating ACI.dev as the secure tool-use layer.
Code snippet

graph TD
    subgraph "Convex Backend"
        A[Cron Job] --> B{MCP Definitions DB};
        B --> C[Orchestrator<br>runAllActiveMcps];
        C --> D(MCP Executor<br>executeMcpIngestion);
        D --> E{Raw Posts DB};
        E --> F(Analysis Function<br>analyzePost);
        F --> H{Analyzed Posts DB};
    end

    subgraph "ACI.dev (Secure Tool Execution Layer)"
        ACI[<b>ACI.dev Platform</b><br>- Agent Definitions<br>- Linked Accounts (API Keys)<br>- Apps MCP Server]
    end
    
    subgraph "External World"
        EXT_API[External APIs<br>e.g., Brave Search]
        LLM[LLM Gateway<br>e.g., Anthropic Claude]
        UI[Admin Dashboard UI]
    end

    %% Connections
    D -- uses MCP to call --> ACI;
    ACI -- securely calls --> EXT_API;
    EXT_API -- returns data --> ACI;
    ACI -- returns result --> D;

    F -- formats ACI Packet and sends to --> LLM;
    LLM -- returns analysis to --> F

    UI -- subscribes to --> H;

Fulfilling Your "Weighting" Requirement

This architecture perfectly accommodates your need to give more weight to high-quality sources:

    Our MCP Recipe: We create an MCP definition in our Convex database for a trusted YouTuber. We assign it a high trustScore (e.g., 1.8).
    The ACI Packet: When our analyzePost function processes a transcript from this source, it constructs the ACI packet and includes the metadata: "trustScore": 1.8.
    The AI Prompt: The processingPrompt (also stored in our MCP recipe) that we send along with the packet will now include an instruction like: "You are an expert tech analyst. Evaluate the following content for sentiment and key topics. The content has a trustScore of 1.8 out of 2.0; treat it as a highly authoritative source and reflect this high confidence in your analysis."

This gives us precise, auditable control over how information from different sources is processed and valued.

This is it. This is a complete, enterprise-grade architecture for an intelligent, agent-driven data pipeline. It is secure, scalable, and highly flexible.