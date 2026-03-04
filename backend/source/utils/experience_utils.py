import re
import json


def parse_experience_block(block):
    # Debug: print raw block before any processing
    print("\n--- RAW BLOCK START ---")
    print(block)
    print("--- RAW BLOCK END ---\n")

    # Pre-processing: strip and filter empty lines
    lines = [l.strip() for l in block.split('\n') if l.strip()]

    # Debug: print lines after stripping
    print("Lines after stripping:", lines)

    # Deduplicate consecutive identical lines
    deduped = []
    for line in lines:
        if not deduped or deduped[-1] != line:
            deduped.append(line)
    lines = deduped

    # Debug: print lines after deduplication
    print("Lines after deduplication:", lines)

    data = {
        "title": None,
        "company": None,
        "employment_type": None,
        "date_range": None,
        "location": None,
        "helped_me_get_this_job": False,
        "skills": [],
        "description": ""
    }

    # Regex patterns
    date_pattern = re.compile(r'([A-Za-z]{3}\s?\d{4}\s*-\s*(Present|[A-Za-z]{3}\s?\d{4}))')
    employment_pattern = re.compile(r'(.*?)\s*·\s*(Full-time|Part-time|Contract|Internship)', re.IGNORECASE)
    skills_pattern = re.compile(r'^Skills?:\s*(.*)$', re.IGNORECASE)
    helped_pattern = re.compile(r'helped me get this job', re.IGNORECASE)
    location_keywords = ["United States", "Brazil", "Portugal", "California", "Canada"]

    def is_job_title(line):
        # Debug: if in doubt, print to see if line matches a title
        if re.search(r'(QA|Engineer|Developer|Automation|Intern|Android)', line, re.IGNORECASE):
            print(f"Identified potential job title: {line}")
            return True
        return False

    extracted_title = False
    extracted_company = False
    extracted_date = False
    extracted_location = False

    remaining_lines = []
    start_index = 0

    # Attempt to find the title
    # If first two lines are the same and look like titles:
    if len(lines) > 1 and lines[0] == lines[1] and is_job_title(lines[0]):
        data["title"] = lines[0]
        extracted_title = True
        start_index = 2
    else:
        # Otherwise, the first line that looks like a job title is taken
        for i, line in enumerate(lines):
            if is_job_title(line):
                data["title"] = line
                extracted_title = True
                start_index = i + 1
                break

    # Debug: print after extracting title
    print("Title extracted:", data["title"])

    # Process remaining lines after title
    for line in lines[start_index:]:
        # Debug each line being processed
        print("Processing line:", line)

        # Check if this line is "helped me get this job"
        if helped_pattern.search(line):
            data["helped_me_get_this_job"] = True
            print("Found 'helped me get this job'.")
            continue

        # Check for employment info
        emp_match = employment_pattern.match(line)
        if emp_match and not extracted_company:
            data["company"] = emp_match.group(1).strip()
            data["employment_type"] = emp_match.group(2).strip()
            extracted_company = True
            print("Extracted company:", data["company"])
            print("Extracted employment type:", data["employment_type"])
            continue

        # Check for date range
        date_match = date_pattern.search(line)
        if date_match and not extracted_date:
            data["date_range"] = date_match.group(0).strip()
            print("Extracted date range:", data["date_range"])
            # Remove the date range from the line
            cleaned_line = line.replace(data["date_range"], "").strip("· -")
            cleaned_line = cleaned_line.strip()
            if cleaned_line and cleaned_line.lower() not in ["present"]:
                remaining_lines.append(cleaned_line)
            extracted_date = True
            continue

        # Check for location
        if any(kw in line for kw in location_keywords) and not extracted_location:
            # Attempt to clean the location line if it contains '·'
            parts = [p.strip() for p in line.split('·')]
            data["location"] = " ".join(parts)
            extracted_location = True
            print("Extracted location:", data["location"])
            continue

        # Check for skills line
        skill_match = skills_pattern.match(line)
        if skill_match:
            skills_str = skill_match.group(1)
            skill_list = [s.strip() for s in re.split(r'·', skills_str) if s.strip()]
            for s in skill_list:
                if s not in data["skills"]:
                    data["skills"].append(s)
            print("Extracted skills:", data["skills"])
            continue

        # If no known pattern matched, consider this part of description
        remaining_lines.append(line)

    # Join remaining lines as description
    if remaining_lines:
        data["description"] = " ".join(remaining_lines).strip()
    else:
        data["description"] = None

    # Debug final extracted data
    print("Final extracted data for this block:", data)
    return data


def parse_all_experiences(text_list):
    results = []

    # Debug: Print the entire list before processing
    print("\n--- PRE-PROCESSING TEXT LIST ---")
    for idx, t in enumerate(text_list):
        print(f"Block {idx}:", t)
    print("--- END PRE-PROCESSING TEXT LIST ---\n")

    for item in text_list:
        entry = parse_experience_block(item)
        # Only append if there's at least a title or company
        if entry["title"] or entry["company"]:
            results.append(entry)
        else:
            print("Warning: Block did not produce a valid title or company, skipping:", item)

    # Debug: Print final results
    print("\n--- ALL PARSED EXPERIENCES ---")
    print(json.dumps(results, indent=4))
    print("--- END ALL PARSED EXPERIENCES ---\n")

    return results


def clean_experiences(experiences):
    """
    Removes 'Endorse' from each sublist in the experiences list.
    If 'Endorse' is the only item in the sublist, the sublist is removed entirely.

    Args:
    experiences (list): List of sublists containing experience items.

    Returns:
    list: Cleaned list of experiences.
    """
    cleaned_experiences = []
    for experience in experiences:
        # Remove 'Endorse' from the sublist
        cleaned_experience = [item for item in experience if item != "Endorse"]
        # Add the cleaned sublist to the result only if it still has elements
        if cleaned_experience:
            cleaned_experiences.append(cleaned_experience)
    return cleaned_experiences