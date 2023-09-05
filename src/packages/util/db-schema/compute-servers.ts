/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { Table } from "./types";
import { ID } from "./crm";

type State = "off" | "starting" | "running" | "stopping";

type Cloud = "user" | "coreweave" | "lambda" | "gcp" | "aws" | "fluidstack";

// todo
type GPU = "a40" | "a10" | "a100_pcie_40gb" | "quadro_rtx_4000";

type CPU = "xeon-v3" | "xeon-v4" | "xeon-scalable" | "amd-mylan";

export interface ComputeServer {
  id: number;
  project_id: string;
  name: string;
  created_by: string;
  color?: string;
  cost_per_hour?: number;
  deleted?: boolean;
  started?: Date;
  started_by?: string;
  state?: State;
  idle_timeout?: number;
  autorestart?: boolean;
  cloud: Cloud;
  gpu?: GPU;
  gpu_count?: number;
  cpu?: CPU;
  core_count?: number;
  memory?: number;
  spot?: boolean;
}

Table({
  name: "compute_servers",
  rules: {
    primary_key: "id",
  },
  fields: {
    id: ID,
    created_by: {
      type: "uuid",
      desc: "User that originally created this compute server.",
      render: { type: "account" },
    },
    name: {
      type: "string",
      pg_type: "VARCHAR(254)",
      desc: "Name of this computer server.  Used purely to make it easier for the user to keep track of it.",
      render: { type: "text", maxLength: 254, editable: true },
    },
    color: {
      type: "string",
      desc: "A user configurable color, which is used for tags and UI to indicate where a tab is running.",
      pg_type: "VARCHAR(30)",
      render: { type: "color", editable: true },
    },
    cost_per_hour: {
      title: "Cost per Hour",
      desc: "The cost in US dollars per hour that this compute server cost us when it is run, the last time we started it.",
      type: "number",
      pg_type: "real",
    },
    deleted: {
      type: "boolean",
      desc: "True if the compute server has been deleted.",
    },
    project_id: {
      type: "uuid",
      desc: "The project id that this compute server provides compute for.",
    },
    started: {
      type: "timestamp",
      desc: "When this compute server was started.",
    },
    started_by: {
      type: "uuid",
      desc: "User that started this compute server, if it is currently running.  They are the one paying for it.",
      render: { type: "account" },
    },
    state: {
      type: "string",
      desc: "One of - 'off', 'starting', 'running', 'stopping'",
      pg_type: "VARCHAR(16)",
    },
    idle_timeout: {
      type: "number",
      desc: "The idle timeout in seconds of this compute server. If set to 0, never turn it off automatically.  The compute server idle timeouts if none of the tabs it is providing are actively touched through the web UI.",
    },
    autorestart: {
      type: "boolean",
      desc: "If true and the compute server stops for any reason, then it will be automatically started again.  This is primarily useful for stop instances.",
    },
    cloud: {
      type: "string",
      pg_type: "varchar(30)",
      desc: "The cloud where this compute server runs: 'user', 'coreweave', 'lambda', 'gcp', 'aws', 'fluidstack'.",
    },
    gpu: {
      type: "string",
      pg_type: "varchar(128)",
      desc: "The GPU: 'a40', 'a10', 'a100_pcie_40gb', 'quadro_rtx_4000', etc.",
    },
    gpu_count: {
      type: "number",
      desc: "The number of GPU's",
    },
    cpu: {
      type: "string",
      pg_type: "varchar(128)",
      desc: "The cpu type: 'xeon-v3', 'xeon-v4', 'xeon-scalable', 'amd-mylan', etc.",
    },
    core_count: {
      type: "number",
      desc: "The number of CPU cores",
    },
    memory: {
      type: "number",
      desc: "Memory in GB",
    },
    spot: {
      type: "boolean",
      desc: "If true, tries to run this as a spot instance, so it may get killed, but costs less.",
    },
  },
});
