const SitemapGenerator = require("sitemap-generator");
const xml2js = require("xml2js");
const fs = require("fs");
const url = require("url");
const countriesOrigin = [
  {
    country: "us",
    lang: "en"
  },
  {
    country: "ca",
    lang: "en"
  },
  {
    country: "gb",
    lang: "en"
  },
  {
    country: "au",
    lang: "en"
  },
  {
    country: "hk",
    lang: "en"
  },
  {
    country: "my",
    lang: "en"
  },
  {
    country: "int",
    lang: "en"
  },
  {
    country: "in",
    lang: "en"
  },
  {
    country: "fr",
    lang: "fr"
  },
  {
    country: "nl",
    lang: "nl"
  },
  {
    country: "pe",
    lang: "es"
  },
  {
    country: "mx",
    lang: "es"
  }
];

const countries = countriesOrigin.slice();

function parseStringPromise(xmlData) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser();
    const res = parser.parseString(xmlData, function(err, res) {
      if (!err) {
        resolve(res);
      } else {
        reject();
      }
    });
  });
}
function compareUrl(urlOrigin, urlCompare) {
  return (
    url
      .parse(urlOrigin)
      .pathname.split("/")
      .slice(3)
      .join("/") ===
    url
      .parse(urlCompare)
      .pathname.split("/")
      .slice(3)
      .join("/")
  );
}
function urlItemfindRefs(curItem, jsonAll, targetNow) {
  let refItems = [];
  const jsonOthers = jsonAll.filter(
    v => JSON.stringify(v.target) !== JSON.stringify(targetNow)
  );
  jsonOthers.forEach(item => {
    item.data.urlset.url.forEach(urlItemCompare => {
      if (compareUrl(curItem.loc[0], urlItemCompare.loc[0])) {
        refItems.push({
          $: {
            rel: "alternate",
            hreflang: `${item.target.lang}-${item.target.country}`,
            href: urlItemCompare.loc[0]
          }
        });
      }
    });
  });
  refItems.forEach(ref => {
    if (ref.$.hreflang === "en-us") {
      refItems.push({
        $: {
          rel: "alternate",
          hreflang: "en",
          href: ref.$.href
        }
      });
    }
  });
  if (targetNow.country === "us" && targetNow.lang === "en") {
    refItems.push({
      $: {
        rel: "alternate",
        hreflang: "en",
        href: curItem.loc[0]
      }
    });
  }
  return refItems;
}

async function paddingHrefLang() {
  const targets = countriesOrigin.slice();
  const jsonResOps = targets.map(async targetCountry => {
    const xmlData = fs.readFileSync(
      `./sitemap_${targetCountry.lang}-${targetCountry.country}.tmp.xml`,
      "utf8"
    );
    return parseStringPromise(xmlData);
  });
  const jsonResRaw = await Promise.all(jsonResOps);
  const jsonRes = jsonResRaw.map((val, ind) => {
    // clean same url ,eg. "/a/b" and "/a/b/"
    val.urlset.url = val.urlset.url.filter(urlItem => {
      if (urlItem.loc[0].endsWith("/")) {
        const urlTrimmed = urlItem.loc[0].slice(0, -1);
        if (val.urlset.url.find(urlCompare => urlCompare.loc[0] === urlTrimmed))
          return false;
        else return true;
      }
      return true;
    });
    return {
      target: targets[ind],
      data: val
    };
  });
  const computedRefsRes = jsonRes.map(item => {
    item.data.urlset.$["xmlns:xhtml"] = "http://www.w3.org/1999/xhtml";
    item.data.urlset.url = item.data.urlset.url.map(urlItem => {
      const refs = urlItemfindRefs(urlItem, jsonRes, item.target);
      if (refs.length > 0) urlItem["xhtml:link"] = refs;
      return urlItem;
    });
    return item;
  });
  computedRefsRes.forEach(refsResItem => {
    var builder = new xml2js.Builder();
    var xml = builder.buildObject(refsResItem.data);
    console.log(
      `generate sitemap for ${refsResItem.target.lang}-${
        refsResItem.target.country
      } `
    );
    fs.writeFileSync(
      `./sitemap_${refsResItem.target.lang}-${refsResItem.target.country}.xml`,
      xml
    );
  });
}

function crawlCountry() {
  const targetCountry = countries.shift();
  console.log(
    `crawling https://www.edifier.com/${targetCountry.country}/${
      targetCountry.lang
    }`
  );
  const generator = SitemapGenerator(
    `https://www.edifier.com/${targetCountry.country}/${targetCountry.lang}`,
    {
      filepath: `./sitemap_${targetCountry.lang}-${
        targetCountry.country
      }.tmp.xml`,
      stripQuerystring: false
    }
  );

  // register event listeners
  generator.on("done", () => {
    if (countries.length > 0) {
      crawlCountry();
    } else {
      paddingHrefLang();
    }
  });
  generator.start();
}
function genereteGlobalSitemap() {
  const sitemap = countriesOrigin.map(target => {
    return {
      loc: `https://www.edifier.com/sitemap_${target.lang}-${
        target.country
      }.xml`
    };
  });
  const sitemapAll = {
    sitemapindex: {
      $: {
        xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
      },
      sitemap
    }
  };
  const builder = new xml2js.Builder();
  const xml = builder.buildObject(sitemapAll);
  console.log(`generate global sitemap`);
  fs.writeFileSync(`./sitemap.xml`, xml);
}
genereteGlobalSitemap();
// paddingHrefLang();
crawlCountry();
