import json
import shlex
import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse, parse_qs


@dataclass
class CurlCommand:
    """A structured representation of a cURL command's components."""
    url: str = ""
    method: str = "GET"
    headers: dict[str, str] = field(default_factory=dict)
    body: Optional[str] = None
    compressed: bool = False

    def validate(self) -> list[str]:
        """
        Validates the command for essentials needed by the LinkedIn API.
        Returns a list of error strings.
        """
        errors = []
        # Case-insensitive check for csrf-token
        if not any(k.lower() == 'csrf-token' for k in self.headers):
            errors.append("Validation Error: Missing 'csrf-token' header.")

        # Case-insensitive check for Cookie header and JSESSIONID
        cookie_header_key = next((k for k in self.headers if k.lower() == 'cookie'), None)
        if not cookie_header_key:
            errors.append("Validation Error: Missing 'Cookie' header.")
        elif 'JSESSIONID' not in self.headers.get(cookie_header_key, ''):
            errors.append("Validation Error: Missing 'JSESSIONID' in cookies.")

        return errors

    def compare(self, other: 'CurlCommand'):
        """Prints a detailed comparison against another CurlCommand object."""
        print("\n--- Comparing Generated Command with Working Example ---")
        print(f"URL Match: {self.url == other.url}")
        print(f"Method Match: {self.method == other.method}")

        print("\n--- Header Comparison ---")
        my_headers = set(k.lower() for k in self.headers.keys())
        other_headers = set(k.lower() for k in other.headers.keys())

        if my_headers == other_headers:
            print("Header names match perfectly (case-insensitive).")
        else:
            print(f"Headers Missing from Generated: {sorted(list(other_headers - my_headers))}")
            print(f"Headers Extra in Generated: {sorted(list(my_headers - other_headers))}")

        # Compare cookies by parsing the 'Cookie' header
        cookie_header_key_self = next((k for k in self.headers if k.lower() == 'cookie'), None)
        cookie_header_key_other = next((k for k in other.headers if k.lower() == 'cookie'), None)

        my_cookies = dict(
            item.strip().split('=', 1) for item in self.headers.get(cookie_header_key_self, '').split(';') if
            '=' in item)
        other_cookies = dict(
            item.strip().split('=', 1) for item in other.headers.get(cookie_header_key_other, '').split(';') if
            '=' in item)

        print("\n--- Cookie Comparison ---")
        my_cookie_names = set(my_cookies.keys())
        other_cookie_names = set(other_cookies.keys())

        if my_cookie_names == other_cookie_names:
            print("Cookie names match perfectly.")
        else:
            print(f"Cookies Missing from Generated: {sorted(list(other_cookie_names - my_cookie_names))}")
            print(f"Cookies Extra in Generated: {sorted(list(my_cookie_names - other_cookie_names))}")


def parse_bash_curl(curl_string: str) -> CurlCommand:
    """Parses a bash cURL command string into a CurlCommand object."""
    cmd = CurlCommand()
    curl_string = curl_string.replace('\\\n', ' ').strip()
    args = shlex.split(curl_string)

    if len(args) > 1 and args[0] == 'curl':
        cmd.url = args[1]

    args_iter = iter(args[2:])
    for arg in args_iter:
        if arg in ('-H', '--header'):
            header_val = next(args_iter)
            name, value = header_val.split(':', 1)
            cmd.headers[name.strip()] = value.strip()
        elif arg in ('-b', '--cookie'):
            cmd.headers['Cookie'] = next(args_iter)
        elif arg in ('-X', '--request'):
            cmd.method = next(args_iter).upper()
        elif arg == '--data-raw':
            cmd.body = next(args_iter)
        elif arg == '--compressed':
            cmd.compressed = True
    return cmd


def find_master_cookie(har_data: dict) -> str:
    """
    Scans the entire HAR file to find the most complete 'Cookie' header.
    This is used as a reliable fallback for requests missing auth info.
    """
    print("DEBUG: Searching for the best available 'Cookie' header in the HAR file...")
    best_cookie = ""
    for entry in har_data.get('log', {}).get('entries', []):
        for header in entry.get('request', {}).get('headers', []):
            if header.get('name', '').lower() == 'cookie' and 'JSESSIONID' in header.get('value', ''):
                if 'li_at' in header.get('value', ''):
                    print("DEBUG: Found a high-quality 'Cookie' header with 'li_at'.")
                    return header.get('value')
                if not best_cookie:
                    best_cookie = header.get('value')

    if best_cookie:
        print("DEBUG: Found a fallback 'Cookie' header (without 'li_at').")
    else:
        print("DEBUG: Could not find any 'Cookie' header in the HAR file.")

    return best_cookie


def build_command_from_har(entry: dict, fallback_cookie: str) -> Optional[CurlCommand]:
    """
    Builds a CurlCommand object from a HAR entry, using a fallback cookie
    if the entry is missing its own.
    """
    req = entry.get('request', {})
    if not req.get('url'):
        return None

    cmd = CurlCommand(
        url=req.get('url'),
        method=req.get('method', 'GET').upper(),
        compressed=True
    )

    final_headers = {h['name']: h['value'] for h in req.get('headers', []) if
                     h.get('name') and not h.get('name').startswith(':')}

    cookie_key = next((k for k in final_headers if k.lower() == 'cookie'), None)
    if not cookie_key and fallback_cookie:
        final_headers['Cookie'] = fallback_cookie

    cmd.headers = final_headers

    post_data = req.get('postData')
    if post_data and 'text' in post_data:
        cmd.body = post_data['text']

    return cmd


def serialize_to_powershell(cmd: CurlCommand) -> str:
    """Serializes a CurlCommand object to a PowerShell Invoke-WebRequest string."""

    def ps_quote(s):
        if isinstance(s, str) and "'" in s:
            return f"'{s.replace("'", "''")}'"
        return f"'{s}'"

    parts = ['curl', '-Uri', ps_quote(cmd.url)]
    if cmd.method != 'GET':
        parts.extend(['-Method', cmd.method])

    header_parts = [f"{ps_quote(name)} = {ps_quote(value)}" for name, value in cmd.headers.items()]
    if header_parts:
        header_str = "; ".join(header_parts)
        parts.extend(['-Headers', f"@{{{header_str}}}"])

    if cmd.body:
        parts.extend(['-Body', ps_quote(cmd.body)])
        ct_key = next((k for k in cmd.headers if k.lower() == 'content-type'), None)
        if ct_key:
            parts.extend(['-ContentType', ps_quote(cmd.headers[ct_key])])

    return ' '.join(parts)


def main():
    """
    Main function to process the HAR file, find requests based on a keyword,
    and then run a debug comparison on the first valid result.
    """
    har_file = 'linkedin.har.json'
    output_file = 'filtered_curls.json'
    keyword_in_response = 'About the job'

    # This is the known-good cURL command to use as a benchmark for debugging.
    working_bash_curl = r'''curl 'https://www.linkedin.com/voyager/api/graphql?variables=(jobPostingDetailDescription_start:0,jobPostingDetailDescription_count:5,jobCardPrefetchQuery:(prefetchJobPostingCardUrns:List(urn%3Ali%3Afsd_jobPostingCard%3A%284247012595%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284242599356%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284230416777%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284192449615%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284257440399%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284251838981%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284246700316%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284245579888%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284219963753%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284178798092%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284249962540%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284217638535%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284248021162%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284223003592%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284251405861%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284190476714%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284201151336%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284245245993%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284143563457%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284222504534%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284219660464%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284246102695%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284137047243%2CJOB_DETAILS%29,urn%3Ali%3Afsd_jobPostingCard%3A%284245119859%2CJOB_DETAILS%29),jobUseCase:JOB_DETAILS,count:5),jobDetailsContext:(isJobSearch:false))&queryId=voyagerJobsDashJobCards.174f05382121bd73f2f133da2e4af893' \
  -H 'accept: application/vnd.linkedin.normalized+json+2.1' \
  -H 'accept-language: en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7' \
  -b 'bcookie="v=2&8dbfbdc7-e798-40ce-8645-afc560856845"; bscookie="v=1&2025021218502355028f04-83cc-48ed-8919-ec97e40bda49AQE-zsW9viyonHpVi4HpRFLzIsEFwyoJ"; g_state={"i_l":0}; liap=true; JSESSIONID="ajax:2584240299603910567"; dfpfpt=02f41f47dbb840f9b833d6e8dfc0b0f4; li_ep_auth_context=AM9hcHA9YWNjb3VudENlbnRlckh1YixhaWQ9Mjc4NDA2MDY2LGlpZD0zMjQzMzI2NTAscGlkPTI3NjY4NDk4NixleHA9MTc0MjUzNjIwNTc0NyxjdXI9dHJ1ZXxhcHA9c2FsZXNOYXZpZ2F0b3IsYWlkPTI3ODQwNjA2NixpaWQ9NDIwODYxNDY1LHBpZD0yNzY2ODQ5ODYsZXhwPTE3NDUwOTk5ODI2ODcsY3VyPXRydWUsc2lkPTE1Mjk0MTEwMDQsY2lkPTIwMTAwNDU2NzQBf0iA5XMh-eRvJ2QB4KS5KK8SUNQ; li_theme=dark; li_theme_set=user; timezone=America/Fortaleza; sdui_ver=sdui-flagship:0.1.6871+sdui-flagship.production; lang=v=2&lang=en-us; li_at=AQEFAHUBAAAAABSqG7UAAAGXXzKSSAAAAZfQlkN3TQAAGHVybjpsaTptZW1iZXI6MTAyNjk0MzMwNWYm1DqJn9kEYGnmmj4HkCVrpl3L5eJp6SCHmQzh2UvTrNb4ZCrO6KrDqSahqKv352NrmK4nJ1ykljhPY1R_9fkxPKDDuXtFCJ252bFBMOqLHvgD4aER9aFWxI8uVrqQ-XclO2lS7kCDkElsJKBhmnizusR5CU2Vp131PBgPeO4t3b3NWk0VPkYPH7fgogE7wmRuSTI; fptctx2=taBcrIH61PuCVH7eNCyH0FWPWMZs3CpAZMKmhMiLe%252bGSJM5F%252bTt2yo01yfcQpUp%252bXn7iyTiojlnIHsNNj29I4nZhkbIIfSGaS1yuiC9b2DS691Q5rnDgBPPHGmgmOkxJhNIPRxzb69mDGCSS6KMaJjOlGxjTcvkZg4H8QoNdZTirTHLyDdvqhP9Qi44b5qliPs90O%252fQ7PQYMaUJFsnTggQUTH47qM%252bLnIc%252fXNd1YXIXi%252fsvfSwjp9r5iYWwvsN8xpe%252bSn14yKsCEsD6hCD9Le%252b%252bEJaXOYnyUDnAGBHwr1HmEQe2S6krwlysJHZ1y%252fwKYAh3ICj6r%252fZqRcTXKmsb%252flEEpmbqYIqiS%252fMdJJXvEj3M%253d; lidc="b=VB05:s=V:r=V:a=V:p=V:g=7864:u=300:x=1:i=1750951126:t=1751037526:v=2:sig=AQGcDjPx96XRCaQDtbpfU2VgoKeGkd_R"; __cf_bm=VabO5FKa3onugbDRp.G0Tp9SmGG0ZJVmOQfiNSPH9hg-1750952724-1.0.1.1-3ra.6EMwRoUGwwsNvYYFq8dKj5kvjbgnGg5XBhRwkXqP7um8JciWefYurGwNyILE80CrrpBSHwO8paudJbaXIWA_MBHiKCzZ7OYQD5ENTLc; UserMatchHistory=AQKVfCZbYTo7SgAAAZes9soIN74nzXTrFqzVr3ps0Ib9FA5gtO1IstaHvqgne-SjbYyELqKEcb0jBmMjMi94kB_dlJQaq7luE-LMANOJlEf6G-aBj_q749Na8iueorG02K-k98U8QWu8G1zdlAF2DKSfVD253Q9YlxYpTXkj7K0ArSKnAPw7Ea7N1Siau2FL-FusKiJjIVulZxT547yRymJ7OW2ebGV3nMXHw_d3s4tcFdAVKy8fRtvQ80RB1jEVwPopUlpGuUFBxMzLqTqm4Rw8LKDN9BXq7NUWMW_vxjUWoQCtdRTXysyrmMQ4uue3DA_5OoOhopopg3EIflVh' \
  -H 'csrf-token: ajax:2584240299603910567' \
  -H 'dnt: 1' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4244689637&discover=recommended&discoveryOrigin=JOBS_HOME_JYMBII&start=24' \
  -H 'sec-ch-prefers-color-scheme: dark' \
  -H 'sec-ch-ua: "Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0' \
  -H 'x-li-lang: en_US' \
  -H 'x-li-page-instance: urn:li:page:d_flagship3_job_collections_discovery_landing;ZCIJ5zHhSiSXlZywFO2gnw==' \
  -H 'x-li-prefetch: 1' \
  -H 'x-li-track: {"clientVersion":"1.13.36769","mpVersion":"1.13.36769","osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}' \
  -H 'x-restli-protocol-version: 2.0.0' \
  --compressed'''

    try:
        with open(har_file, 'r', encoding='utf-8') as f:
            har_data = json.load(f)
    except Exception as e:
        print(f"Error loading HAR file: {e}")
        return

    master_cookie = find_master_cookie(har_data)

    all_command_objects = []
    print(f"\n--- Searching for responses containing '{keyword_in_response}' ---")

    for i, entry in enumerate(har_data.get('log', {}).get('entries', [])):
        response_text = entry.get('response', {}).get('content', {}).get('text', '')

        if response_text and keyword_in_response.lower() in response_text.lower():
            print(f"Found keyword in response of entry index {i}. Generating command...")

            command_obj = build_command_from_har(entry, master_cookie)

            if command_obj:
                errors = command_obj.validate()
                if errors:
                    print(f"  - Warning: Generated command for entry {i} is invalid: {errors}")
                else:
                    all_command_objects.append(command_obj)

    if not all_command_objects:
        print("\nNo valid commands could be generated from matching responses.")
        return

    # --- Run Debug Comparison ---
    # Parse the known-good command and compare it with the first valid command we generated.
    print("\n\n--- Starting Debug Comparison ---")
    working_command = parse_bash_curl(working_bash_curl)
    print("Parsed known-good command from 'working_bash_curl' variable.")
    all_command_objects[0].compare(working_command)

    # --- Save all valid commands to file ---
    final_results = []
    for cmd_obj in all_command_objects:
        final_results.append({
            'url': cmd_obj.url,
            'powershell_command': serialize_to_powershell(cmd_obj)
        })

    with open(output_file, 'w', encoding='utf-8') as out:
        json.dump(final_results, out, indent=2, ensure_ascii=False)

    print(f"\nSuccess! Found and processed {len(final_results)} matching requests.")
    print(f"Runnable PowerShell commands saved to '{output_file}'.")


if __name__ == '__main__':
    main()
