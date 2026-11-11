// 从 specs/openapi.yaml 同源生成的类型与客户端封装
export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string>;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
