/*
Cloud filesystem menu.
*/

import { Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { A, Icon } from "@cocalc/frontend/components";
import { useMemo, useState } from "react";
import openSupportTab from "@cocalc/frontend/support/open";

function getItems(cloudFilesystem): MenuProps["items"] {
  const help = {
    key: "help",
    icon: <Icon name="question-circle" />,
    label: "Help",
    children: [
      {
        key: "documentation",
        icon: <Icon name="question-circle" />,
        label: (
          <A href="https://doc.cocalc.com/compute_server.html">Documentation</A>
        ),
      },
      {
        key: "support",
        icon: <Icon name="medkit" />,
        label: "Support",
      },
      {
        key: "videos",
        icon: <Icon name="youtube" style={{ color: "red" }} />,
        label: (
          <A href="https://www.youtube.com/playlist?list=PLOEk1mo1p5tJmEuAlou4JIWZFH7IVE2PZ">
            Videos
          </A>
        ),
      },
    ],
  };
  return [
    {
      key: "edit-title-and-colors",
      icon: <Icon name={"colors"} />,
      label: "Edit Title and Color",
    },
    {
      disabled: cloudFilesystem.deleting,
      danger: cloudFilesystem.mount,
      key: "mount",
      icon: <Icon name={cloudFilesystem.mount ? "stop" : "run"} />,
      label: cloudFilesystem.mount ? "Unmount" : "Mount",
    },
    {
      disabled: cloudFilesystem.deleting || cloudFilesystem.mount,
      key: "edit-mountpoint",
      icon: <Icon name="folder-open" />,
      label: "Edit Mountpoint",
    },
    {
      disabled: cloudFilesystem.deleting || cloudFilesystem.mount,
      danger: true,
      key: "delete",
      icon: <Icon name="trash" />,
      label: "Delete",
    },
    help,
  ];
}

export default function Menu({
  cloudFilesystem,
  style,
  setError,
  size,
  fontSize,
  show,
}: {
  cloudFilesystem;
  style?;
  setError;
  size?;
  fontSize?;
  show;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const { items, onClick } = useMemo(() => {
    if (!open) {
      return { onClick: () => {}, items: [] };
    }

    return {
      items: getItems(cloudFilesystem),
      onClick: async (obj) => {
        setOpen(false);
        let cmd = obj.key.startsWith("top-") ? obj.key.slice(4) : obj.key;
        switch (cmd) {
          case "mount":
            show.setShowMount(true);
            break;
          case "edit-mountpoint":
            show.setShowEditMountpoint(true);
            break;
          case "edit-title-and-colors":
            show.setShowEditTitleAndColors(true);
            break;
          case "delete":
            show.setShowDelete(true);
            break;
          case "documentation":
          case "videos":
            // click opens new tab anyways
            break;
          case "support":
            openSupportTab({
              type: "question",
              subject: `Compute Server (Id: ${cloudFilesystem.id})`,
              body: `I am using a compute server, and have a question...`,
            });
            break;

          default:
            setError(`not implemented -- '${cmd}'`);
        }
      },
    };
  }, [cloudFilesystem, open]);

  return (
    <div style={style}>
      <Dropdown
        menu={{ items, onClick }}
        trigger={["click"]}
        onOpenChange={setOpen}
      >
        <Tooltip title="Customize and control cloud filesystem">
          <Button type="text" size={size}>
            <Icon
              name="ellipsis"
              style={{ fontSize: fontSize ?? "15pt", color: "#000" }}
              rotate="90"
            />
          </Button>
        </Tooltip>
      </Dropdown>
    </div>
  );
}
