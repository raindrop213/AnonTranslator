function searchMojidict(word) {
    fetch("https://api.mojidict.com/parse/functions/union-api", {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        "functions": [
          {
            "name": "search-all",
            "params": {
              "text": word,
              "types": [102, 106, 103]
            }
          }
        ],
        "_ApplicationId": "E62VyFVLMiW7kvbtVq3p"
      })
    })
    .then(response => response.json())
    .then(data => {
      let result = "";
      for (let i of data.result.results["search-all"].result.word.searchResult) {
        result += `${i.title}<br>${i.excerpt}<br><br>`;
      }
      console.log(result);
    })
    .catch(error => {
      console.error(error);
    });
  }
  
  searchMojidict('濡れ場');
  