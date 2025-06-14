#!/usr/bin/env python3
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

import requests
from dateutil.relativedelta import relativedelta

from curl_command_builder import Command, build_commands
from source.linkedin_api.entities.recommended_jobs_analysis.recomended_jobs import extract_recommended_jobs
from source.path.path_reference import get_data_folder_path

LOGLEVEL = logging.INFO
DATE_FILTER = {"years": 0, "months": 6, "days": 0}
DATA_FOLDER = get_data_folder_path()

logging.basicConfig(level=LOGLEVEL, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")


def execute_commands(
        commands: List[Command],
        date_filter: Optional[Dict[str, int]] = None,
        extraction_function: Optional[callable] = None
) -> list:
    if not commands:
        return []

    sess = requests.Session()
    sess.headers.update(commands[0].headers)
    for name, val in commands[0].cookies.items():
        sess.cookies.set(name, val)

    threshold = datetime.now() - relativedelta(**date_filter) if date_filter else None
    results: list = []
    stop = False

    for index, cmd in enumerate(commands, start=1):
        print(f"Executing command #{index}/{len(commands)}: {cmd.url}")
        if stop:
            break
        resp = sess.get(cmd.url, timeout=15)
        if not resp.ok:
            continue

        data = resp.json()
        # choose either applied _or_ recommended here:
        jobs = extraction_function(data)  # or extract_applied_jobs(data)
        for job in jobs:
            # if threshold and isinstance(job, AppliedJob) and job.applied_on:
            #     if _applied_to_dt(job.applied_on) < threshold:
            #         logging.info("Reached threshold at %s, stopping.", job.applied_on)
            #         stop = True
            #         break
            results.append(job)
    return results


def fetch_linkedin_api_data_pipeline(
        curl_file: str = "curl.txt",
        output: str = f"{DATA_FOLDER}/recommended_jobs.json",
        extraction_function: Optional[callable] = None
):
    cmds = build_commands(curl_file)
    logging.info("Built %d commands", len(cmds))

    jobs = execute_commands(commands=cmds, date_filter=None, extraction_function=extraction_function)
    with open(output, "w", encoding="utf-8") as fh:
        json.dump([job.__dict__ for job in jobs], fh, ensure_ascii=False, indent=2)
    logging.info("Wrote %d jobs to %s", len(jobs), output)


if __name__ == "__main__":
    fetch_linkedin_api_data_pipeline()
