import { writable, type Writable } from 'svelte/store';
import {
  getAllProfilesLinks,
  getLatestProfile,
  type Profile,
  type ProfileStatus
} from './profiles.store';
import type { ActionHash, AgentPubKey, Link } from '@holochain/client';
import hc from '@services/HolochainClientService';

export const administrators: Writable<Profile[]> = writable([]);
export const agentIsAdministrator: Writable<boolean> = writable(false);

export async function registerAdministrator(original_profile_hash: ActionHash): Promise<boolean> {
  return await hc.callZome('profiles', 'register_administrator', original_profile_hash);
}

export async function checkIfAgentIsAdministrator(agentPubKey: AgentPubKey): Promise<void> {
  agentIsAdministrator.set(
    await hc.callZome('profiles', 'check_if_agent_is_administrator', agentPubKey)
  );
}

export async function getAllAdministratorsLinks(): Promise<Link[]> {
  return (await hc.callZome('profiles', 'get_all_administrators_links', null)) as Link[];
}

export async function getAllAdministrators(): Promise<void> {
  const links = await getAllAdministratorsLinks();
  let administratorProfilesPromises = links.map(
    async (link) => await getLatestProfile(link.target)
  );

  const administratorProfiles = (await Promise.all(administratorProfilesPromises)).filter(
    (p) => p !== null
  ) as Profile[];

  administrators.set(administratorProfiles);
}

export async function removeAdministrator(original_profile_hash: ActionHash): Promise<boolean> {
  return await hc.callZome('profiles', 'remove_administrator', original_profile_hash);
}

export async function getNonAdministratorProfilesLinks(): Promise<Link[]> {
  const adminlinks: Link[] = await getAllAdministratorsLinks();
  const links = await getAllProfilesLinks();
  return links.filter((l) => !adminlinks.includes(l));
}

export async function getNonAdministratorProfiles(): Promise<Profile[]> {
  const adminlinks: Link[] = await getAllAdministratorsLinks();

  const links = await getAllProfilesLinks();

  const profiles = await Promise.all(
    links
      .filter((l) => !adminlinks.includes(l))
      .map(async (link) => await getLatestProfile(link.target))
  );

  return profiles.filter((p) => p !== null) as Profile[];
}

export async function updateProfileStatus(
  original_profile_hash: ActionHash,
  previous_profile_hash: ActionHash,
  status: ProfileStatus
): Promise<boolean> {
  return await hc.callZome('profiles', 'update_person_status', {
    original_profile_hash,
    previous_profile_hash,
    status
  });
}
