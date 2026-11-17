import { redirect } from '@sveltejs/kit';

// The test managers moved into the hREA dashboard as its second tab (U14).
// The query string is kept: dev progenitor mode and the e2e suite connect
// through hcPort and hcToken in it.
export const load = ({ url }: { url: URL }) => {
  const params = new URLSearchParams(url.search);
  params.set('tab', 'test');
  redirect(308, `/admin/hrea?${params.toString()}`);
};
