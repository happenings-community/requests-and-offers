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
      // If no value is pre-selected, default to the first timezone
      if (!value && filteredTimezones.length > 0) {
        value = filteredTimezones[0];
        onchange?.(value);
      }
    }
  });

  $effect(() => {
    timezones.sort();
  });

  function filterTimezones(event: any) {
    search = event.target.value.trim();
    filteredTimezones = timezones.filter((tz) => tz.toLowerCase().includes(search.toLowerCase()));
    // Auto-select the first timezone from the filtered list (if any)
    if (filteredTimezones.length > 0) {
      value = filteredTimezones[0];
      onchange?.(value);
    }
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
    class="input mb-2 w-full"
    oninput={filterTimezones}
  />
  <select {name} {id} class="select w-full" {required} bind:value onchange={handleSelectChange}>
    <option value="">Select timezone...</option>
    {#each filteredTimezones as tz}
      <option value={tz}>{getTimezoneDisplay(tz)}</option>
    {/each}
  </select>
</label>
