import { currentTzOffset, localDate } from '@tiny-pos/shared';

/** Ngày địa phương hôm nay "YYYY-MM-DD" theo giờ máy. */
export const today = () => localDate(new Date(), currentTzOffset());
