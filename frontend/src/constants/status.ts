export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: '待分配',
  ASSIGNED: '已分配',
  IN_TRANSIT: '配送中',
  DELIVERED: '已送达',
  FAILED: '配送失败',
  CANCELLED: '已取消',
}

export const TASK_STATUS_LABEL: Record<string, string> = {
  CREATED: '已创建',
  ASSIGNED: '已分配',
  STARTED: '配送中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export const VEHICLE_STATUS_LABEL: Record<string, string> = {
  IDLE: '空闲',
  ON_DUTY: '出车中',
  MAINTENANCE: '维护中',
}

export const DRIVER_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: '可用',
  ON_DUTY: '出车中',
  OFF: '休息',
  OFF_DUTY: '休息',
}