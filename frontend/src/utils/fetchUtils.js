export const generateCurlCommand = (jsonString) => {
    try {
        const config = JSON.parse(jsonString);
        const url = new URL(config.base_url);
        Object.keys(config).forEach(key => {
            if (key.startsWith('variables_')) {
                const queryParamKey = key.replace('variables_', '');
                url.searchParams.append(queryParamKey, config[key]);
            }
        });

        let curlCmd = `curl '${url.toString()}'`;

        if (config.method && config.method.toUpperCase() !== 'GET') {
            curlCmd += ` \\\n  -X ${config.method.toUpperCase()}`;
        }

        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                const headerValue = typeof value === 'object' ? JSON.stringify(value) : value;
                curlCmd += ` \\\n  -H '${key}: ${headerValue.replace(/'/g, "'\\''")}'`;
            }
        }

        if (config.body && config.body !== 'null') {
            const bodyValue = typeof config.body === 'object' ? JSON.stringify(config.body) : config.body;
            curlCmd += ` \\\n  --data-raw '${bodyValue.replace(/'/g, "'\\''")}'`;
        }

        curlCmd += ' \\\n  --compressed';
        return curlCmd;
    } catch (e) {
        console.error("Could not generate cURL command:", e);
        return "Invalid JSON configuration. Cannot generate cURL.";
    }
};

export const generateFetchCommand = (jsonString) => {
    try {
        const config = JSON.parse(jsonString);
        const queryParams = [];
        const variableParts = {};
        const nestedQueryParts = {};

        for (const key in config) {
            if (key.startsWith('variables_query_')) {
                const paramName = key.replace('variables_query_', '');
                nestedQueryParts[paramName] = config[key];
            } else if (key.startsWith('variables_')) {
                const paramName = key.replace('variables_', '');
                variableParts[paramName] = config[key];
            }
        }

        queryParams.push('includeWebMetadata=true');
        if (config.query_id) {
            queryParams.push(`queryId=${config.query_id}`);
        }

        const nestedQueryString = Object.entries(nestedQueryParts)
            .map(([key, value]) => `${key}:${value}`)
            .join(',');

        if (nestedQueryString) {
            variableParts['query'] = `(${nestedQueryString})`;
        }

        const variablesString = Object.entries(variableParts)
            .map(([key, value]) => `${key}:${value}`)
            .join(',');

        if (variablesString) {
            queryParams.push(`variables=(${variablesString})`);
        }

        const finalUrl = `${config.base_url}?${queryParams.join('&')}`;
        const fetchOptions = {
            headers: config.headers || {},
            method: config.method || 'GET',
            body: config.body,
        };

        if (fetchOptions.method.toUpperCase() === 'GET' || fetchOptions.method.toUpperCase() === 'HEAD') {
            delete fetchOptions.body;
        }

        return `fetch("${finalUrl}", ${JSON.stringify(fetchOptions, null, 2)});`;
    } catch (e) {
        console.error("Could not generate fetch command:", e);
        return "Invalid JSON configuration. Cannot generate fetch command.";
    }
};