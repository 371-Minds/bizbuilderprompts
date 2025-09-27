#!/usr/bin/env python3
"""
Prompt Classifier and Manager.

This script is designed to be run from a GitHub Action in the bizbuilderprompts repo.
It will:
1. Scan the 'incoming/' directory for new prompt files.
2. Classify each prompt based on its content.
3. Move the file to the appropriate category directory.
4. Update the main README.md with a summary of the library.
"""

import os
import shutil
import re
from pathlib import Path

# --- Configuration ---
INCOMING_DIR = "incoming"
CATEGORIES = {
    "sales": ["close", "deal", "offer", "discount", "price", "negotiate"],
    "marketing": ["campaign", "brand", "social", "email", "ad", "audience"],
    "product": ["feature", "build", "develop", "roadmap", "spec", "user story"],
    "customer_success": ["onboard", "support", "help", "tutorial", "guide", "resolve"],
    "general": [],  # Default category
}

def classify_prompt(content: str) -> str:
    """
    A simple keyword-based classifier.
    In a more advanced setup, you could use an ML model or an LLM API here.
    """
    content_lower = content.lower()
    
    for category, keywords in CATEGORIES.items():
        if category == "general":
            continue # Check this last
        if any(keyword in content_lower for keyword in keywords):
            return category
    
    return "general"

def create_category_dirs():
    """Ensure all category directories exist."""
    for category in CATEGORIES.keys():
        Path(category).mkdir(exist_ok=True)

def process_incoming_prompts():
    """Main function to process all prompts in the incoming directory."""
    incoming_path = Path(INCOMING_DIR)
    if not incoming_path.exists():
        print("No 'incoming' directory found. Nothing to do.")
        return

    prompt_files = list(incoming_path.glob("*.txt")) # Adjust glob as needed (.md, etc.)
    if not prompt_files:
        print("No prompt files found in 'incoming/'.")
        return

    print(f"Found {len(prompt_files)} prompt(s) to process.")
    for prompt_file in prompt_files:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        category = classify_prompt(content)
        new_path = Path(category) / prompt_file.name
        
        # Handle potential name conflicts by adding a counter
        counter = 1
        original_name = new_path.stem
        original_suffix = new_path.suffix
        while new_path.exists():
            new_path = Path(category) / f"{original_name}_{counter}{original_suffix}"
            counter += 1

        print(f"Moving '{prompt_file}' to '{category}' as '{new_path.name}'")
        shutil.move(str(prompt_file), str(new_path))

def update_readme():
    """A simple function to update the README with a list of categories and prompts."""
    readme_content = "# Biz Builder Prompts\n\n"
    readme_content += "A curated library of prompts for building your business.\n\n"
    
    for category in sorted(CATEGORIES.keys()):
        category_path = Path(category)
        if not category_path.exists():
            continue
        
        prompt_files = list(category_path.glob("*"))
        if not prompt_files:
            continue
            
        readme_content += f"## {category.replace('_', ' ').title()}\n\n"
        for pf in sorted(prompt_files):
            readme_content += f"- `{pf.name}`\n"
        readme_content += "\n"

    with open("README.md", "w", encoding='utf-8') as f:
        f.write(readme_content)

    print("Updated README.md")

if __name__ == "__main__":
    create_category_dirs()
    process_incoming_prompts()
    update_readme()
