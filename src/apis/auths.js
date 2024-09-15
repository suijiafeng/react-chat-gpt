import request from "./config";
import { WEBUI_API_BASE_URL} from '../constants'
export const userSignIn = (params = {}) => {
  const { email, password } = params
  return request.post(`${WEBUI_API_BASE_URL}/auths/signin`, { email, password })
}
export const userSignUp = (params = {}) => {
  const { name, email, password, profile_image_url = '' } = params
  return request.post(`${WEBUI_API_BASE_URL}/auths/signup`, { name, email, password, profile_image_url })
}
export const checkAuthStatus = (params = {}) => {
  return request.get(`${WEBUI_API_BASE_URL}/auths/`, params)
}