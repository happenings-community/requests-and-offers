<script lang="ts">
  import { DateTime } from 'luxon';

  type Props = {
    value?: string;
    required?: boolean;
    label?: string;
    name?: string;
    id?: string;
    onchange?: (value: string | undefined) => void;
  };

  let {
    value = $bindable(),
    required = false,
    label = 'Time Zone',
    name,
    id,
    onchange
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

  function handleSelectChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newValue = target.value || undefined;
    onchange?.(newValue);
  }
</script>

<label class="label">
  {label} <span class="text-error-500">{required ? '*' : ''}</span>
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
    bind:value
    onchange={handleSelectChange}
  >
    <option value="">Select timezone...</option>
    {#each filteredTimezones as tz}
      <option value={tz}>{getTimezoneDisplay(tz)}</option>
    {/each}
  </select>
</label>