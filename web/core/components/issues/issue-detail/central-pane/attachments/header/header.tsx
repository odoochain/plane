"use client";
import React, { FC } from "react";
import { observer } from "mobx-react";
import { Paperclip } from "lucide-react";
// components
import { CentralPaneHeaderActionButton } from "@/components/issues/issue-detail/central-pane";

type Props = {};

export const AttachmentsHeader: FC<Props> = observer((props) => {
  const {} = props;

  return (
    <CentralPaneHeaderActionButton
      title="Attachments"
      icon={<Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-custom-text-300" />}
    />
  );
});
