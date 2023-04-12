/*
 *  This file is part of CoCalc: Copyright © 2023 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { create as createXML } from "xmlbuilder2";

import LRU from "lru-cache";
const cache = new LRU<"db" | Channel | "all", any>({
  max: 10,
  ttl: 10 * 60 * 1000,
});

import getPool from "@cocalc/database/pool";
import getCustomize from "@cocalc/server/settings/customize";
import { slugURL } from "@cocalc/util/news";
import {
  CHANNELS,
  CHANNELS_DESCRIPTIONS,
  Channel,
  NewsItem,
} from "@cocalc/util/types/news";
import { GetServerSideProps } from "next";
import { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import { renderMarkdown } from "lib/news";
import { capitalize } from "@cocalc/util/misc";

export default function RSS() {
  return null;
}

// we exclude hidden and future news items
const Q = `
SELECT
  id, channel, title, text, url,
  extract(epoch from date::timestamp)::integer as date
FROM news
WHERE date BETWEEN NOW() - '6 months'::interval AND NOW()
  AND hide IS NOT TRUE
ORDER BY date DESC
LIMIT 100`;

// caches the DB result for a bit
async function getRSS(): Promise<NewsItem[]> {
  const rssCached = cache.get("db");
  if (rssCached) return rssCached;
  const pool = getPool("long");
  const { rows } = await pool.query(Q);
  cache.set("db", rows as NewsItem[]);
  return rows;
}

// we have one RSS channel. this populates it with all entries from the database – with the given ordering
async function populateNewsItems(
  xml: XMLBuilder,
  ch: Channel | "all",
  dns: string
): Promise<XMLBuilder> {
  for (const n of await getRSS()) {
    const { id, text, title, date, channel } = n;
    if (ch != "all" && channel !== ch) continue;
    const pubDate: Date =
      typeof date === "number" ? new Date(date * 1000) : date;
    // URL visible to the user
    const url = `https://${dns}/${slugURL(n)}`;
    // GUID must be globally unique, not shown to USER
    const guid = `https://${dns}/news/${id}`;

    xml
      .ele("item")
      .ele("title")
      .dat(title)
      .up()
      .ele("link")
      .txt(url)
      .up()
      .ele("description")
      .dat(renderMarkdown(text))
      .up()
      .ele("pubDate")
      .txt(pubDate.toUTCString())
      .up()
      .ele("guid")
      .txt(guid)
      .up();
  }

  return xml;
}

// render RSS news feed
// check: https://validator.w3.org/feed/check.cgi
// Ref: https://www.w3.org/Protocols/rfc822/ (e.g. that's why it's date.toUTCString())
// There can only be one channel per RSS feed, but we let users filter by channel.
async function getXML(channel?: string): Promise<string> {
  const { siteName, dns } = await getCustomize();
  if (!dns) throw Error("no dns");

  const ch: Channel | "all" =
    channel && CHANNELS.includes(channel as Channel)
      ? (channel as Channel)
      : "all";

  const cached = cache.get(ch);
  if (cached) return cached;

  const selfLink = `https://${dns}/news/rss.xml`;
  const atom = "http://www.w3.org/2005/Atom";
  const descExtra = ch === "all" ? "" : `${CHANNELS_DESCRIPTIONS[ch]}. `;

  const root = createXML({ version: "1.0", encoding: "UTF-8" })
    .ele("rss", { version: "2.0" })
    .att(atom, "xmlns:atom", atom);

  const xml: XMLBuilder = root
    .ele("channel")
    .ele("atom:link", {
      href: selfLink,
      rel: "self",
      type: "application/rss+xml",
    })
    .up()
    .ele("title")
    .txt(`${siteName} News${ch != "all" ? `– ${capitalize(ch)}` : ""}`)
    .up()
    .ele("description")
    .txt(
      `News about ${siteName}. ${descExtra}Also available at https://${dns}/news`
    )
    .up()
    .ele("link")
    .txt(selfLink)
    .up()
    .ele("pubDate")
    .txt(new Date().toUTCString())
    .up();

  await populateNewsItems(xml, ch, dns);

  const xmlstr = xml.end({ prettyPrint: true });
  cache.set(ch, xmlstr);
  return xmlstr;
}

export const getServerSideProps: GetServerSideProps = async ({
  query,
  res,
}) => {
  if (!res) return { props: {} };
  const { channel } = query;
  const ch = typeof channel === "string" ? channel : undefined;

  try {
    res.setHeader("Content-Type", "text/xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.write(await getXML(ch));
    res.end();
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end();
  }

  return {
    props: {},
  };
};
