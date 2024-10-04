// helpers
import { API_BASE_URL } from "@/helpers/common.helper";
import { checkURLValidity } from "@/helpers/string.helper";

/**
 * @description combine the file path with the base URL
 * @param {string} path
 * @returns {string} final URL with the base URL
 */
export const getFileURL = (path: string): string | undefined => {
  if (!path) return undefined;
  const isValidURL = checkURLValidity(path);
  if (isValidURL) return path;
  return `${API_BASE_URL}${path}`;
};
