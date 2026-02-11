import json
import re
from dataclasses import asdict, dataclass, field
from typing import List, Optional


# --- Dataclasses (as defined above) ---

@dataclass
class Company:
    """Represents the company that posted the job."""
    name: Optional[str] = None
    url: Optional[str] = None


@dataclass
class Description:
    """Represents the detailed job description."""
    about: Optional[str] = None
    responsibilities: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    full_text: Optional[str] = None


@dataclass
class JobPosting:
    """Represents a single job posting."""
    title: Optional[str] = None
    company: Company = field(default_factory=Company)
    location: Optional[str] = None
    workplace_type: Optional[str] = None
    employment_type: Optional[str] = None
    posted_on: Optional[str] = None
    applicants: Optional[int] = None
    job_state: Optional[str] = None
    job_url: Optional[str] = None
    description: Description = field(default_factory=Description)


def extract_job_details(job_data: dict) -> Optional[JobPosting]:
    """Extracts job details from a single job posting JSON object."""
    try:
        included_items = job_data.get("detailResponse", {}).get("included", [])

        # Find the main job posting data
        posting_card_info = next(
            (item for item in included_items if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobPostingCard"),
            {})
        posting_info = next(
            (item for item in included_items if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobPosting"), {})
        description_info = next(
            (item for item in included_items if item.get("$type") == "com.linkedin.voyager.dash.jobs.JobDescription"),
            {})
        company_info = next(
            (item for item in included_items if item.get("$type") == "com.linkedin.voyager.dash.organization.Company"),
            {})
        workplace_info = next(
            (item for item in included_items if item.get("$type") == "com.linkedin.voyager.dash.jobs.WorkplaceType"),
            {})
        job_application_info = next((item for item in included_items if
                                     item.get("$type") == "com.linkedin.voyager.dash.jobs.JobSeekerApplicationDetail"),
                                    {})

        title = posting_info.get("title")
        job_state = posting_info.get("jobState")

        company_name = company_info.get("name")
        company_url = posting_card_info.get("logo", {}).get("actionTarget")

        location = posting_card_info.get("navigationBarSubtitle", "").split("·")[1].strip() if posting_card_info.get(
            "navigationBarSubtitle") else None

        workplace_type = workplace_info.get("localizedName")

        # Extract employment type from insights if available
        insights = posting_card_info.get("jobInsightsV2ResolutionResults", [])
        employment_type = None
        if insights and insights[0].get("jobInsightViewModel"):
            for desc in insights[0]["jobInsightViewModel"].get("description", []):
                text = desc.get("text", {}).get("text")
                if "time" in text.lower() or "freelance" in text.lower():
                    employment_type = text
                    break

        posted_on_text = description_info.get("postedOnText", "")
        posted_on = posted_on_text.replace("Posted on ", "").strip(".") if posted_on_text else None

        tertiary_description = posting_card_info.get("tertiaryDescription", {}).get("text", "")
        applicants = None
        if "applicants" in tertiary_description:
            try:
                applicants = int(tertiary_description.split("·")[2].strip().split(" ")[0])
            except (ValueError, IndexError):
                pass

        raw_job_url = job_application_info.get("companyApplyUrl")
        job_url = re.sub(r'/job-apply/(\d+)$', r'/jobs/view/\1/', raw_job_url) if raw_job_url else None

        # Extracting description sections
        full_desc_text = description_info.get("descriptionText", {}).get("text", "")
        about, responsibilities, requirements, benefits = None, None, None, None

        if "About The Role" in full_desc_text:
            about_start = full_desc_text.find("About The Role")
            req_start = full_desc_text.find("Requirements")
            ben_start = full_desc_text.find("Benefits")

            about = full_desc_text[about_start:req_start].strip()
            requirements = full_desc_text[req_start:ben_start].strip()
            benefits = full_desc_text[ben_start:].strip()
        elif "Responsabilidades e atribuições" in full_desc_text:
            resp_start = full_desc_text.find("Responsabilidades e atribuições")
            req_start = full_desc_text.find("Requisitos e qualificações")
            ben_start = full_desc_text.find("Nossos Benefícios")

            responsibilities = full_desc_text[resp_start:req_start].strip()
            requirements = full_desc_text[req_start:ben_start].strip()
            benefits = full_desc_text[ben_start:].strip()

        return JobPosting(
            title=title,
            company=Company(name=company_name, url=company_url),
            location=location,
            workplace_type=workplace_type,
            employment_type=employment_type,
            posted_on=posted_on,
            applicants=applicants,
            job_state=job_state,
            job_url=job_url,
            description=Description(
                about=about,
                responsibilities=responsibilities,
                requirements=requirements,
                benefits=benefits,
                full_text=full_desc_text
            )
        )

    except (StopIteration, IndexError) as e:
        print(f"Could not process a job posting due to missing data: {e}")
        return None


def main():
    """Loads, processes, and saves job posting data."""
    try:
        with open("raw_job_details.json", "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except FileNotFoundError:
        print("Error: job_details.json not found.")
        return
    except json.JSONDecodeError:
        print("Error: Could not decode JSON from job_details.json.")
        return

    structured_jobs = []
    for job_entry in raw_data:
        job_details = extract_job_details(job_entry)
        if job_details:
            structured_jobs.append(asdict(job_details))

    with open("structured_job_details.json", "w", encoding="utf-8") as f:
        json.dump(structured_jobs, f, indent=2, ensure_ascii=False)

    print("Successfully created structured_job_details.json")


if __name__ == "__main__":
    main()