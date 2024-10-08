"use client";

import { FC, useEffect, useState, useMemo } from "react";
import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import { TIssue } from "@plane/types";
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/ui";
// components
import { IssueView, TIssueOperations } from "@/components/issues";
// constants
import { ISSUE_UPDATED, ISSUE_DELETED, ISSUE_ARCHIVED, ISSUE_RESTORED } from "@/constants/event-tracker";
import { EIssuesStoreType } from "@/constants/issue";
// hooks
import { useEventTracker, useIssueDetail, useIssues, useUserPermissions } from "@/hooks/store";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import { EUserPermissions, EUserPermissionsLevel } from "@/plane-web/constants/user-permissions";

interface IIssuePeekOverview {
  embedIssue?: boolean;
  embedRemoveCurrentNotification?: () => void;
  is_archived?: boolean;
  isDraft?: boolean;
}

export const IssuePeekOverview: FC<IIssuePeekOverview> = observer((props) => {
  const { embedIssue = false, embedRemoveCurrentNotification, is_archived = false, isDraft = false } = props;
  // router
  const pathname = usePathname();
  // store hook
  const { allowPermissions } = useUserPermissions();

  const {
    issues: { restoreIssue },
  } = useIssues(EIssuesStoreType.ARCHIVED);
  const {
    peekIssue,
    setPeekIssue,
    issue: { fetchIssue, getIsFetchingIssueDetails },
    fetchActivities,
  } = useIssueDetail();

  const { issues } = useIssuesStore();
  const { captureIssueEvent } = useEventTracker();
  // state
  const [error, setError] = useState(false);

  const removeRoutePeekId = () => {
    setPeekIssue(undefined);
    if (embedIssue) embedRemoveCurrentNotification && embedRemoveCurrentNotification();
  };

  const issueOperations: TIssueOperations = useMemo(
    () => ({
      fetch: async (workspaceSlug: string, projectId: string, issueId: string, loader = true) => {
        try {
          setError(false);
          await fetchIssue(
            workspaceSlug,
            projectId,
            issueId,
            is_archived ? "ARCHIVED" : isDraft ? "DRAFT" : "DEFAULT"
          );
          setError(false);
        } catch (error) {
          setError(true);
          console.error("Error fetching the parent issue");
        }
      },
      update: async (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => {
        try {
          if (isDraft && !issues?.updateDraft) throw new Error("Update function not available for draft");
          if (!isDraft && !issues?.updateIssue) throw new Error("Update function not available for non-draft");
          await (isDraft
            ? issues.updateDraft(workspaceSlug, issueId, data)
            : issues.updateIssue(workspaceSlug, projectId, issueId, data));
          await fetchActivities(workspaceSlug, projectId, issueId);
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { ...data, issueId, state: "SUCCESS", element: "Issue peek-overview" },
            updates: {
              changed_property: Object.keys(data).join(","),
              change_details: Object.values(data).join(","),
            },
            path: pathname,
          });
        } catch (error) {
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { state: "FAILED", element: "Issue peek-overview" },
            path: pathname,
          });
          setToast({
            title: "Error!",
            type: TOAST_TYPE.ERROR,
            message: "Issue update failed",
          });
        }
      },
      remove: async (workspaceSlug: string, projectId: string, issueId: string) => {
        try {
          return (
            isDraft
              ? issues.deleteDraft(workspaceSlug, issueId)
              : issues.removeIssue(workspaceSlug, projectId, issueId)
          ).then(() => {
            captureIssueEvent({
              eventName: ISSUE_DELETED,
              payload: { id: issueId, state: "SUCCESS", element: "Issue peek-overview" },
              path: pathname,
            });
            removeRoutePeekId();
          });
        } catch (error) {
          setToast({
            title: "Error!",
            type: TOAST_TYPE.ERROR,
            message: "Issue delete failed",
          });
          captureIssueEvent({
            eventName: ISSUE_DELETED,
            payload: { id: issueId, state: "FAILED", element: "Issue peek-overview" },
            path: pathname,
          });
        }
      },
      archive: async (workspaceSlug: string, projectId: string, issueId: string) => {
        try {
          issues?.archiveIssue && (await issues.archiveIssue(workspaceSlug, projectId, issueId));
          captureIssueEvent({
            eventName: ISSUE_ARCHIVED,
            payload: { id: issueId, state: "SUCCESS", element: "Issue peek-overview" },
            path: pathname,
          });
        } catch (error) {
          captureIssueEvent({
            eventName: ISSUE_ARCHIVED,
            payload: { id: issueId, state: "FAILED", element: "Issue peek-overview" },
            path: pathname,
          });
        }
      },
      restore: async (workspaceSlug: string, projectId: string, issueId: string) => {
        try {
          await restoreIssue(workspaceSlug, projectId, issueId);
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: "Restore success",
            message: "Your issue can be found in project issues.",
          });
          captureIssueEvent({
            eventName: ISSUE_RESTORED,
            payload: { id: issueId, state: "SUCCESS", element: "Issue peek-overview" },
            path: pathname,
          });
        } catch (error) {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "Error!",
            message: "Issue could not be restored. Please try again.",
          });
          captureIssueEvent({
            eventName: ISSUE_RESTORED,
            payload: { id: issueId, state: "FAILED", element: "Issue peek-overview" },
            path: pathname,
          });
        }
      },
      addCycleToIssue: async (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => {
        try {
          isDraft
            ? issues?.updateDraft && (await issues?.updateDraft(workspaceSlug, issueId, { cycle_id: cycleId }))
            : await issues.addCycleToIssue(workspaceSlug, projectId, cycleId, issueId);
          fetchActivities(workspaceSlug, projectId, issueId);
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { issueId, state: "SUCCESS", element: "Issue peek-overview" },
            updates: {
              changed_property: "cycle_id",
              change_details: cycleId,
            },
            path: pathname,
          });
        } catch (error) {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "Error!",
            message: "Issue could not be added to the cycle. Please try again.",
          });
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { state: "FAILED", element: "Issue peek-overview" },
            updates: {
              changed_property: "cycle_id",
              change_details: cycleId,
            },
            path: pathname,
          });
        }
      },
      addIssueToCycle: async (workspaceSlug: string, projectId: string, cycleId: string, issueIds: string[]) => {
        try {
          if (isDraft)
            issues?.updateDraft && (await issues?.updateDraft(workspaceSlug, issueIds[0], { cycle_id: cycleId }));
          else await issues.addIssueToCycle(workspaceSlug, projectId, cycleId, issueIds);
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { ...issueIds, state: "SUCCESS", element: "Issue peek-overview" },
            updates: {
              changed_property: "cycle_id",
              change_details: cycleId,
            },
            path: pathname,
          });
        } catch (error) {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "Error!",
            message: "Issue could not be added to the cycle. Please try again.",
          });
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { state: "FAILED", element: "Issue peek-overview" },
            updates: {
              changed_property: "cycle_id",
              change_details: cycleId,
            },
            path: pathname,
          });
        }
      },
      removeIssueFromCycle: async (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => {
        try {
          const removeFromCyclePromise = isDraft
            ? issues?.updateDraft && (await issues?.updateDraft(workspaceSlug, issueId, { cycle_id: null }))
            : issues.removeIssueFromCycle(workspaceSlug, projectId, cycleId, issueId);
          setPromiseToast(removeFromCyclePromise, {
            loading: "Removing issue from the cycle...",
            success: {
              title: "Success!",
              message: () => "Issue removed from the cycle successfully.",
            },
            error: {
              title: "Error!",
              message: () => "Issue could not be removed from the cycle. Please try again.",
            },
          });
          await removeFromCyclePromise;
          fetchActivities(workspaceSlug, projectId, issueId);
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { issueId, state: "SUCCESS", element: "Issue peek-overview" },
            updates: {
              changed_property: "cycle_id",
              change_details: "",
            },
            path: pathname,
          });
        } catch (error) {
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { state: "FAILED", element: "Issue peek-overview" },
            updates: {
              changed_property: "cycle_id",
              change_details: "",
            },
            path: pathname,
          });
        }
      },
      changeModulesInIssue: async (
        workspaceSlug: string,
        projectId: string,
        issueId: string,
        addModuleIds: string[],
        removeModuleIds: string[]
      ) => {
        const promise = await issues.changeModulesInIssue(
          workspaceSlug,
          projectId,
          issueId,
          addModuleIds,
          removeModuleIds
        );
        fetchActivities(workspaceSlug, projectId, issueId);
        captureIssueEvent({
          eventName: ISSUE_UPDATED,
          payload: { id: issueId, state: "SUCCESS", element: "Issue detail page" },
          updates: {
            changed_property: "module_id",
            change_details: { addModuleIds, removeModuleIds },
          },
          path: pathname,
        });
        return promise;
      },
      removeIssueFromModule: async (workspaceSlug: string, projectId: string, moduleId: string, issueId: string) => {
        try {
          const removeFromModulePromise = isDraft
            ? issues?.updateDraft && (await issues?.updateDraft(workspaceSlug, issueId, { cycle_id: null }))
            : issues.removeIssuesFromModule(workspaceSlug, projectId, moduleId, [issueId]);
          setPromiseToast(removeFromModulePromise, {
            loading: "Removing issue from the module...",
            success: {
              title: "Success!",
              message: () => "Issue removed from the module successfully.",
            },
            error: {
              title: "Error!",
              message: () => "Issue could not be removed from the module. Please try again.",
            },
          });
          await removeFromModulePromise;
          fetchActivities(workspaceSlug, projectId, issueId);
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { id: issueId, state: "SUCCESS", element: "Issue peek-overview" },
            updates: {
              changed_property: "module_id",
              change_details: "",
            },
            path: pathname,
          });
        } catch (error) {
          captureIssueEvent({
            eventName: ISSUE_UPDATED,
            payload: { id: issueId, state: "FAILED", element: "Issue peek-overview" },
            updates: {
              changed_property: "module_id",
              change_details: "",
            },
            path: pathname,
          });
        }
      },
    }),
    [is_archived, isDraft, fetchIssue, issues, restoreIssue, captureIssueEvent, pathname]
  );

  useEffect(() => {
    if (peekIssue) {
      issueOperations.fetch(peekIssue.workspaceSlug, peekIssue.projectId, peekIssue.issueId);
    }
  }, [peekIssue, issueOperations]);

  if (!peekIssue?.workspaceSlug || !peekIssue?.projectId || !peekIssue?.issueId) return <></>;

  // Check if issue is editable, based on user role
  const isEditable = 
  allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    peekIssue?.workspaceSlug,
    peekIssue?.projectId
  );

  return (
    <IssueView
      workspaceSlug={peekIssue.workspaceSlug}
      projectId={peekIssue.projectId}
      issueId={peekIssue.issueId}
      isLoading={getIsFetchingIssueDetails(peekIssue.issueId)}
      isError={error}
      is_archived={is_archived}
      disabled={!isEditable}
      embedIssue={embedIssue}
      embedRemoveCurrentNotification={embedRemoveCurrentNotification}
      issueOperations={issueOperations}
      isDraft={isDraft}
    />
  );
});
