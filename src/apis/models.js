import request from "./config";
import { WEBUI_BASE_URL } from '../constants'
export const getModels = () => {
  return request.get(`${WEBUI_BASE_URL}/api/models`)
};
