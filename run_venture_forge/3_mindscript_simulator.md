
**Task: Build The Workshop - Room 2: The MindScript Simulator**

**Objective:** Create a tool that teaches users the logic of your "MindScript" OS. This tool will take natural language commands and convert them into a structured JSON output, demonstrating the power of a systemized approach to business logic.

**Instructions:**

1.  **Interface:**
    *   Provide a simple text input field where users can type in a command (e.g., "Create a marketing plan for a new SaaS tool").
    *   Include a "Simulate" or "Execute" button.
2.  **Backend:**
    *   When the user submits a command, your backend will process it. You will need to design a simple parser that can recognize the key components of the command (e.g., the action "Create a marketing plan" and the subject "a new SaaS tool").
    *   Based on the parsed command, generate a structured JSON object. For the example above, the JSON might look like this:

    ```json
    {
      "action": "create_marketing_plan",
      "target": {
        "type": "saas_tool",
        "description": "new"
      },
      "steps": [
        "define_target_audience",
        "develop_messaging",
        "select_channels",
        "set_budget",
        "launch_campaign"
      ]
    }
    ```

3.  **Display:**
    *   Display the generated JSON in a clean, formatted way. You can use a library like `highlight.js` to make it look even better.
    *   Consider adding a simple explanation of what the JSON represents and how it could be used by an automated system.

**Next Step:** After the MindScript Simulator is complete, you will build the final room: The Business Idea Validator.
