<script lang="ts">
  import { DateTime } from 'luxon';

  type Props = {
    required?: boolean;
    label?: string;
    name?: string;
    id?: string;
  };

  const {
    required = false,
    label = 'Time Zone',
    name,
    id
  }: Props = $props();

  // State
  let timezones = Intl.supportedValuesOf('timeZone');
  let filteredTimezones: string[] = $state([]);
  let search = $state('');

  $effect(() => {
    if (!search) {
      filteredTimezones = timezones;
    }
  });

  $effect(() => {
    timezones.sort();
  });

  function filterTimezones(event: any) {
    search = event.target.value.trim();
    filteredTimezones = timezones.filter((tz) => tz.toLowerCase().includes(search.toLowerCase()));
  }

  function getTimezoneDisplay(tz: string): string {
    try {
      const now = DateTime.now().setZone(tz);
      const offset = now.toFormat('ZZ');
      return `${tz} (UTC${offset})`;
    } catch (e) {
      return tz;
    }
  }
</script>

<label class="label text-lg">
  {label} {required ? '*' : ''}:
  <input
    type="text"
    placeholder="Search timezones..."
    class="input w-full mb-2"
    oninput={filterTimezones}
  />
  <select 
    name={name} 
    id={id} 
    class="select w-full" 
    {required}
  >
    {#each filteredTimezones as tz}
      <option value={tz}>{getTimezoneDisplay(tz)}</option>
    {/each}
  </select>
</label>