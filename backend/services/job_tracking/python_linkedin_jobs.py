import requests

url = ("https://www.linkedin.com/voyager/api/graphql?variables=(start:0,query:("
       "flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))&queryId=voyagerSearchDashClusters"
       ".5ba32757c00b31aea747c8bebb92855c")

with open("linkedin_cookie.txt", "r", encoding="utf-8") as f:
    cookie_value = f.read().strip()

payload = {}
headers = {
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
    'csrf-token': 'ajax:2584240299603910567',
    'dnt': '1',
    'priority': 'u=1, i',
    'referer': 'https://www.linkedin.com/my-items/saved-jobs/',
    'sec-ch-prefers-color-scheme': 'dark',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 '
                  'Safari/537.36 Edg/138.0.0.0',
    'x-li-lang': 'en_US',
    'x-li-page-instance': 'urn:li:page:d_flagship3_myitems_savedjobs;gGeMib0KRoGTbXxHpSSTfg==',
    'x-li-pem-metadata': 'Voyager - My Items=myitems-saved-jobs',
    'x-li-track': '{"clientVersion":"1.13.37702","mpVersion":"1.13.37702","osName":"web","timezoneOffset":-3,'
                  '"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
                  '"displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
    'x-restli-protocol-version': '2.0.0',
    'Cookie': cookie_value
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)
