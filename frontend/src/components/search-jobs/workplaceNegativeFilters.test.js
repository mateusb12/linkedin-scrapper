import assert from "node:assert/strict";
import test from "node:test";

import {
  getJobWorkplaceType,
  normalizeWorkplaceFilterTerm,
} from "./workplaceNegativeFilters.js";

const remoteJob = { workplace_type: "Remote" };

const filterByExcludedWorkplace = (jobs, excludedWorkplaceTypes) =>
  jobs.filter((job) => {
    const workplaceType = getJobWorkplaceType(job);

    return (
      workplaceType === null || !excludedWorkplaceTypes.includes(workplaceType)
    );
  });

test("filters hybrid jobs by canonical workplace type", () => {
  assert.equal(getJobWorkplaceType({ workplace_type: "Hybrid" }), "hybrid");
  assert.notEqual(getJobWorkplaceType(remoteJob), "hybrid");
});

test("filters onsite jobs by canonical workplace type", () => {
  assert.equal(getJobWorkplaceType({ workplace_type: "On-site" }), "onsite");
  assert.notEqual(getJobWorkplaceType(remoteJob), "onsite");
});

test("excluding hybrid only leaves remote and onsite jobs visible", () => {
  const jobs = [
    { id: "remote", workplace_type: "Remote" },
    { id: "hybrid", workplace_type: "Hybrid" },
    { id: "onsite", workplace_type: "On-site" },
  ];
  const visibleJobs = filterByExcludedWorkplace(jobs, ["hybrid"]);

  assert.deepEqual(
    visibleJobs.map((job) => job.id),
    ["remote", "onsite"],
  );
});

test("excluding onsite only leaves remote and hybrid jobs visible", () => {
  const jobs = [
    { id: "remote", workplace_type: "Remote" },
    { id: "hybrid", workplace_type: "Hybrid" },
    { id: "onsite", workplace_type: "On-site" },
  ];
  const visibleJobs = filterByExcludedWorkplace(jobs, ["onsite"]);

  assert.deepEqual(
    visibleJobs.map((job) => job.id),
    ["remote", "hybrid"],
  );
});

test("excluding hybrid and onsite leaves remote jobs untouched", () => {
  const jobs = [
    { id: "remote", workplace_type: "Remote" },
    { id: "hybrid", workplace_type: "Hybrid" },
    { id: "onsite", workplace_type: "On-site" },
  ];
  const visibleJobs = filterByExcludedWorkplace(jobs, ["hybrid", "onsite"]);

  assert.deepEqual(
    visibleJobs.map((job) => job.id),
    ["remote"],
  );
});

test("normalizes onsite synonyms to the canonical onsite type", () => {
  const blockedTerms = [
    "onsite",
    "on-site",
    "on site",
    "in-person",
    "in person",
    "presential",
    "presencial",
  ];

  blockedTerms.forEach((term) => {
    assert.equal(normalizeWorkplaceFilterTerm(term), "onsite");
  });
});

test("falls back to current payload fields only when canonical type is absent", () => {
  assert.equal(
    getJobWorkplaceType({ location_text: "Brazil (Remote)" }),
    "remote",
  );
  assert.equal(
    getJobWorkplaceType({ location: "Sao Paulo, Brazil (Hybrid)" }),
    "hybrid",
  );
  assert.equal(
    getJobWorkplaceType({ raw: { location_text: "Recife, Brazil (On-site)" } }),
    "onsite",
  );
  assert.equal(getJobWorkplaceType({ work_remote_allowed: true }), "remote");
});
