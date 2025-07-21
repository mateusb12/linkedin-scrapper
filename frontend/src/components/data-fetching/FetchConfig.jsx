// src/components/home/FetchConfig.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { ConfigEditor } from "./ConfigEditor.jsx";
import { useDarkMode } from "../../hooks/useDarkMode.jsx";
import {generateCurlCommand, generateFetchCommand} from "../../utils/fetchUtils.js";

export default function FetchConfig() {
    const [isDark] = useDarkMode();

    // Create separate states for each config type (for Pagination)
    const [paginationJson, setPaginationJson] = useState("Loading...");
    const [paginationFetch, setPaginationFetch] = useState("Loading...");
    const [paginationCurl, setPaginationCurl] = useState("Loading...");

    // Create separate states for each config type (for Individual Job)
    const [individualJobJson, setIndividualJobJson] = useState("Loading...");
    const [individualJobFetch, setIndividualJobFetch] = useState("Loading...");
    const [individualJobCurl, setIndividualJobCurl] = useState("Loading...");

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [isDark]);

    useEffect(() => {
        const paginationUrl    = "http://localhost:5000/fetch-jobs/pagination-curl";
        const individualJobUrl = "http://localhost:5000/fetch-jobs/individual-job-curl";

        const processAndSet = (data, setJson, setFetch, setCurl) => {
            // If the backend stored headers as a JSON string, parse it
            if (data && typeof data.headers === "string") {
                try {
                    data.headers = JSON.parse(data.headers);
                    if (typeof data.headers["x-li-track"] === "string") {
                        data.headers["x-li-track"] = JSON.parse(data.headers["x-li-track"]);
                    }
                } catch (err) {
                    console.error("Failed to parse nested header JSON:", err);
                }
            }

            const jsonString = JSON.stringify(data, null, 2);
            setJson(jsonString);
            setFetch(generateFetchCommand(jsonString));
            setCurl(generateCurlCommand(jsonString));
        };

        Promise.all([axios.get(paginationUrl), axios.get(individualJobUrl)])
            .then(([pagRes, indRes]) => {
                processAndSet(
                    pagRes.data,
                    setPaginationJson,
                    setPaginationFetch,
                    setPaginationCurl
                );
                processAndSet(
                    indRes.data,
                    setIndividualJobJson,
                    setIndividualJobFetch,
                    setIndividualJobCurl
                );
            })
            .catch((err) => {
                console.error("Error fetching configs:", err);
                // Update the UI to show an error message
                const errorMessage = `Failed to fetch config. Check browser console for CORS errors.`;
                setPaginationJson(errorMessage);
                setIndividualJobJson(errorMessage);
            });
    }, []);

    useEffect(() => {
        if (!paginationJson || paginationJson.startsWith("Load") || paginationJson.startsWith("Failed")) return;
        setPaginationFetch(generateFetchCommand(paginationJson));
        setPaginationCurl(generateCurlCommand(paginationJson));
    }, [paginationJson]);

    useEffect(() => {
        if (!individualJobJson || individualJobJson.startsWith("Load") || individualJobJson.startsWith("Failed")) return;
        setIndividualJobFetch(generateFetchCommand(individualJobJson));
        setIndividualJobCurl(generateCurlCommand(individualJobJson));
    }, [individualJobJson]);

    return (
        <div>
            <h1 className="text-3xl font-bold border-b border-gray-300 dark:border-gray-700 pb-3 text-gray-900 dark:text-gray-100">
                Fetch Configuration
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 mb-8">
                Define the GET request details for fetching job data.
            </p>
            <div className="space-y-8">
                <ConfigEditor
                    title="Pagination Request"
                    subtitle="Filter: jobCollectionSlug"
                    jsonValue={paginationJson}
                    setJsonValue={setPaginationJson}
                    fetchValue={paginationFetch}
                    setFetchValue={setPaginationFetch}
                    curlValue={paginationCurl}
                    setCurlValue={setPaginationCurl}
                />
                <ConfigEditor
                    title="Individual Job Request"
                    subtitle="Filter: voyagerJobsDashJobCards"
                    jsonValue={individualJobJson}
                    setJsonValue={setIndividualJobJson}
                    fetchValue={individualJobFetch}
                    setFetchValue={setIndividualJobFetch}
                    curlValue={individualJobCurl}
                    setCurlValue={setIndividualJobCurl}
                />
            </div>
        </div>
    );
}