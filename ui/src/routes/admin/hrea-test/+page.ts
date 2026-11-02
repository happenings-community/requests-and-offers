import { redirect } from '@sveltejs/kit';

// The test managers moved into the hREA dashboard as its second tab (U14).
export const load = () => {
  redirect(308, '/admin/hrea?tab=test');
};
