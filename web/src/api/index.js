import { httpApi } from './http.js'
import { mockApi } from '../mocks/mockApi.js'

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
export const api = USE_MOCKS ? mockApi : httpApi
export { ApiError } from './errors.js'
