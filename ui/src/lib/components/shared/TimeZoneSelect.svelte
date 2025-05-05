<script lang="ts">
  import moment from 'moment-timezone';
  import { Effect as E, pipe } from 'effect';

  type Props = {
    value?: string;
    required?: boolean;
    label?: string;
    onChange?: (value: string | undefined) => void;
    name?: string;
    id?: string;
  };

  const {
    value = undefined,
    required = false,
    label = 'Time Zone',
    onChange = () => {},
    name,
    id
  }: Props = $props();

  // State
  let timezones = $state<string[]>([]);
  let formattedTimezones = $state<{ name: string; formatted: string; offset: number }[]>([]);
  let filteredTimezones = $state<{ name: string; formatted: string; offset: number }[]>([]);
  let search = $state('');
  let isOpen = $state(false);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let selectedValue = $state(value);

  // Initialize timezones immediately using Effect TS
  $effect(() => {
    const loadTimezones = pipe(
      E.sync(() => {
        isLoading = true;
        error = null;
      }),
      E.flatMap(() =>
        E.try({
          try: () => moment.tz.names(),
          catch: (err) => new Error(`Failed to load timezones: ${err}`)
        })
      ),
      E.tap((names) =>
        E.sync(() => {
          timezones = names;
        })
      ),
      E.flatMap(() =>
        E.try({
          try: () => initializeTimezones(),
          catch: (err) => new Error(`Failed to initialize timezones: ${err}`)
        })
      ),
      E.catchAll((err) =>
        E.sync(() => {
          error = err.message;
          console.error('Error loading timezones:', err);
        })
      ),
      E.tap(() =>
        E.sync(() => {
          isLoading = false;
        })
      )
    );

    E.runSync(loadTimezones);
  });

  function formatTimezones(timezoneNames: string[]) {
    return timezoneNames
      .map((timezone) => {
        const offset = moment.tz(timezone).utcOffset();
        const hours = Math.floor(Math.abs(offset) / 60);
        const minutes = Math.abs(offset) % 60;
        const sign = offset >= 0 ? '+' : '-';

        const formatted = `GMT${sign}${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')} ${timezone}`;

        return { name: timezone, formatted, offset };
      })
      .sort((a, b) => a.offset - b.offset);
  }

  function filterTimezones(event: Event) {
    const input = event.target as HTMLInputElement;
    search = input.value.trim();

    // Use requestAnimationFrame to prevent UI freezing
    requestAnimationFrame(() => {
      if (search) {
        const filtered = timezones
          .filter((tz) => tz.toLowerCase().includes(search.toLowerCase()))
          .slice(0, 100); // Limit results to prevent UI freezing
        filteredTimezones = formatTimezones(filtered);
      } else {
        // If search is empty, show common timezones
        initializeTimezones();
      }
    });
  }

  function initializeTimezones() {
    // Only load common timezones initially
    const commonTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Pacific/Auckland',
      'Asia/Singapore',
      'Asia/Dubai',
      'Europe/Berlin',
      'Europe/Moscow',
      'Asia/Kolkata',
      'Asia/Shanghai',
      'Australia/Melbourne',
      'Pacific/Honolulu',
      'Atlantic/Reykjavik'
    ];

    // Use requestAnimationFrame to prevent UI freezing
    requestAnimationFrame(() => {
      formattedTimezones = formatTimezones(commonTimezones);
    });
  }

  function handleValueChange(value: string | undefined) {
    selectedValue = value;
    if (onChange) {
      onChange(value);
    }
  }

  // Handle timezone selection and validation
  $effect(() => {
    if (selectedValue) {
      const found = timezones.find((tz) => tz === selectedValue);
      if (!found) {
        selectedValue = undefined;
      }
    }
    // Call onChange when value changes
    if (onChange) {
      onChange(selectedValue);
    }
  });
</script>

<div class="space-y-2">
  <label class="label">
    <span class="text-lg">
      {label}
      {#if required}<span class="text-error-500">*</span>{/if}
    </span>
    <div class="flex flex-col gap-2 md:flex-row">
      <input
        type="text"
        placeholder="Search timezones..."
        class="input w-full md:w-1/2"
        oninput={filterTimezones}
        onchange={(event) => handleValueChange((event.target as HTMLInputElement).value)}
        onfocus={() => (isOpen = true)}
        aria-label="Search for a timezone"
      />
      <select
        class="select w-full md:w-1/2"
        bind:value={selectedValue}
        onclick={() => (isOpen = true)}
        {required}
        {name}
        {id}
        aria-label="Select a timezone"
      >
        <option value={undefined}>Select a timezone</option>
        {#each formattedTimezones as tz}
          <option value={tz.name}>{tz.formatted}</option>
        {/each}
      </select>
    </div>
  </label>
</div>
