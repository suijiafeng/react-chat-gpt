import request from "./config";
export const userSignIn = (params = {}) => {
  return request.post('/api/v1/auths/signin', params)
}
export const userSignUp = (params = {}) => {
  return request.post('/api/v1/auths/signup', params)
}
export const checkAuthStatus = (params={}) => {
  return request.get('/api/v1/auths/', params)
}