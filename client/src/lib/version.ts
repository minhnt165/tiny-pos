import { currentTzOffset, formatDateVn, localDate } from '@tiny-pos/shared';

/** Version app (package.json gốc) và ngày build theo giờ máy, dạng dd/mm/yyyy. */
export const APP_VERSION = __APP_VERSION__;
export const BUILD_DATE = formatDateVn(localDate(new Date(__BUILD_DATE__), currentTzOffset()));
