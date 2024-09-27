import { TIssue } from "@plane/types";
import { API_BASE_URL } from "@/helpers/common.helper";
import { APIService } from "./api.service";

export class WorkspaceDraftService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getDraftIssues(workspaceSlug: string): Promise<TIssue[]> {
    return this.get(
      `/api/workspaces/${workspaceSlug}/draft-issues/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getDraftIssueById(workspaceSlug: string, issueId: string): Promise<TIssue> {
    return this.get(`/api/workspaces/${workspaceSlug}/draft-issues/${issueId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async createDraftIssue(workspaceSlug: string, data: any): Promise<TIssue> {
    return this.post(`/api/workspaces/${workspaceSlug}/draft-issues/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async updateDraftIssue(workspaceSlug: string, issueId: string, data: any): Promise<void> {
    return this.patch(`/api/workspaces/${workspaceSlug}/draft-issues/${issueId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async deleteDraftIssue(workspaceSlug: string, issueId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/draft-issues/${issueId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

}