/*
Working with Google Cloud images.

The Google cloud api from https://www.npmjs.com/package/@google-cloud/compute for images
is in theory documented at:

- https://cloud.google.com/compute/docs/reference/rest/v1/images
- https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-compute/src/v1/images_client.ts

The only way to actually use it is really study the docs *and* the
autogenerated typescript definitions.

Do not bother with any LLM's, at least as of Sept 2023, as they all (Bard, GPT-4, etc.)
are incredibly wildly wrong about everything about @google-cloud/compute.  Hopefully
this will change someday, since it would be nice, and all the information to correctly
train those models is available on github.  But oh my god what a nightmare.

In any case, typescript for the win here.
*/

import { getCredentials } from "./client";
import { ImagesClient } from "@google-cloud/compute";
import TTLCache from "@isaacs/ttlcache";
import dayjs from "dayjs";
import type { GoogleCloudConfiguration } from "@cocalc/util/db-schema/compute-servers";
import { field_cmp } from "@cocalc/util/misc";

export type ImageType = "cuda" | "standard";
export type Architecture = "x86_64" | "arm64";

const PREFIX = "cocalc-compute";

// Return the latest available image of the given type on the configured cluster.
// Returns null if no images of the given type are available.

export function imageName({
  type,
  date,
  tag,
  arch = "x86_64",
}: {
  type: ImageType;
  date?: Date;
  tag?: string;
  arch?: Architecture;
}) {
  const prefix = `${PREFIX}-${type}-${arch == "x86_64" ? "x86" : arch}`; // _ not allowed
  if (!date) {
    return prefix;
  }

  // this format matches with what we use internally on cocalc.com for
  // docker images in Kubernetes:
  const dateFormatted = dayjs(date).format("YYYY-MM-DD-HHmmss");
  return `${prefix}-${dateFormatted}${tag ? "-" + tag : ""}`;
}

let client: ImagesClient | undefined = undefined;
let projectId: string | undefined;
export async function getImagesClient() {
  if (client != null && projectId != null) {
    return { client, projectId };
  }
  const credentials = await getCredentials();
  client = new ImagesClient(credentials);
  projectId = credentials.projectId as string;
  return { client, projectId };
}

// filters are documented at https://cloud.google.com/sdk/gcloud/reference/topic/filters/
// and "The matching is anchored and case insensitive. An optional trailing * does a
// word prefix match."

const imageCache = new TTLCache({ ttl: 60 * 1000 });

type ImageList = {
  name: string;
  labels: object;
  diskSizeGb: string;
  creationTimestamp: string;
}[];
export async function getAllImages({
  type,
  arch = "x86_64",
  image,
  labels,
}: {
  type: ImageType;
  arch?: Architecture;
  image?: string;
  labels?: object;
}): Promise<ImageList> {
  const cacheKey = JSON.stringify({ type, arch, labels });
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }
  let prefix = imageName({ type, arch });
  if (image) {
    prefix = `${prefix}-${image}`;
  }
  const { client, projectId } = await getImagesClient();
  let filter = `name:${prefix}*`;
  if (labels != null) {
    for (const key in labels) {
      filter += ` AND labels.${key}=${labels[key]} `;
    }
  }
  const [images] = await client.list({
    project: projectId,
    maxResults: 1000,
    filter,
  });
  imageCache.set(cacheKey, images as ImageList);
  return images as ImageList;
}

function getArchitecture(machineType: string): Architecture {
  return machineType.startsWith("t2a-") ? "arm64" : "x86_64";
}

export async function getNewestProdSourceImage({
  machineType,
  image,
  acceleratorType,
  test,
}: GoogleCloudConfiguration): Promise<{
  sourceImage: string;
  diskSizeGb: number;
}> {
  const type = acceleratorType ? "cuda" : "standard";
  const arch = getArchitecture(machineType);
  const images = await getAllImages({
    type,
    arch,
    image,
    labels: test || image ? undefined : { prod: true },
  });
  if (images.length == 0) {
    throw Error(
      `no images are available for ${type} ${arch} compute servers that are labeled prod=true`,
    );
  }
  // sort and get newest -- note that creationTimestamp is a string
  images.sort(field_cmp("creationTimestamp"));
  const newest = images[images.length - 1];
  const { name, diskSizeGb } = newest;
  const { projectId } = await getCredentials();
  return {
    sourceImage: `projects/${projectId}/global/images/${name}`,
    diskSizeGb: parseInt(diskSizeGb),
  };
}

// name = exact full name of the image
export async function setImageLabel({
  name,
  key,
  value,
}: {
  name: string;
  key: string;
  value: string | null | undefined;
}) {
  const { client, projectId } = await getImagesClient();
  const [image] = await client.get({
    project: projectId,
    image: name,
  });
  const { labels, labelFingerprint } = image;
  if (value == null) {
    if (labels[key] == null) {
      // nothing to do
      return;
    }
    delete labels[key];
  } else {
    labels[key] = `${value}`;
  }

  await client.setLabels({
    project: projectId,
    resource: name,
    globalSetLabelsRequestResource: {
      labels,
      labelFingerprint,
    },
  });
}
