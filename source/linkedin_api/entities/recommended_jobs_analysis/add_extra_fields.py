import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from source.path.path_reference import get_data_folder_path

# Initialize OpenAI client
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise EnvironmentError("OPENAI_API_KEY not set in environment variables.")

client = OpenAI(api_key=api_key)


def extract_fields(description: str) -> dict:
    """
    Call the OpenAI API to extract structured fields from a job description.
    Returns a dict with the extracted fields.
    """
    prompt = f"""
Given the following job description, extract the fields as JSON:
- required_experience_years
- skills_required
- skills_desired
- soft_skills
- job_responsibilities
- tools_technologies
- language_requirements
- employment_model
- work_model
- company_benefits
- recruiting_tags

Description:
{description}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts structured data from job descriptions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0
        )
        content = response.choices[0].message.content
        print("Raw OpenAI response:", content[:200], "..." if len(content) > 200 else "")

        # Attempt to extract JSON block
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        else:
            print("Warning: No JSON object found in response.")
            return {}
    except Exception as e:
        print(f"Error during OpenAI call: {e}")
        return {}


def augment_jobs(input_path: str, output_path: str):
    # Load the existing jobs JSON
    with open(input_path, 'r', encoding='utf-8') as f:
        jobs = json.load(f)

    total = len(jobs)

    for i, job in enumerate(jobs, start=1):
        desc = job.get('description_text', '')
        job_id = job.get('job_id', f'index_{i}')
        if desc and len(desc.strip()) > 0:
            print(f"Processing job {i}/{total}: {job_id}")
            extras = extract_fields(desc)
            job.update(extras)
            time.sleep(1)  # avoid rate limiting
        else:
            print(f"Skipping job {i}/{total}: {job_id} – No description.")

    # Save back to a new file (or overwrite)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    # Determine file paths relative to the script location
    base = get_data_folder_path()
    input_file = base / 'job_details_summary.json'
    output_file = base / 'job_details_augmented.json'

    augment_jobs(str(input_file), str(output_file))
    print(f"Augmented data saved to {output_file}")
