import type { UIServiceType } from '$lib/types/ui';

// Sorting criteria
export type ServiceTypeSortField = 'name' | 'type' | 'created_at' | 'updated_at';
export type ServiceTypeSortDirection = 'asc' | 'desc';

export interface ServiceTypeSortState {
  field: ServiceTypeSortField;
  direction: ServiceTypeSortDirection;
}

export interface ServiceTypeSortReturn {
  sortState: ServiceTypeSortState;
  sortServiceTypes: (serviceTypes: UIServiceType[]) => UIServiceType[];
  updateSort: (field: ServiceTypeSortField, direction?: ServiceTypeSortDirection) => void;
  toggleSort: (field: ServiceTypeSortField) => void;
  getSortIcon: (field: ServiceTypeSortField) => string;
  isSortedBy: (field: ServiceTypeSortField) => boolean;
}

export function useServiceTypeSorting(
  initialField: ServiceTypeSortField = 'type',
  initialDirection: ServiceTypeSortDirection = 'asc'
): ServiceTypeSortReturn {
  // Initialize sort state with default: non-technical first (type ascending)
  const state = $state<ServiceTypeSortState>({
    field: initialField,
    direction: initialDirection
  });

  // Sort service types based on current criteria
  function sortServiceTypes(serviceTypes: UIServiceType[]): UIServiceType[] {
    const sorted = [...serviceTypes].sort((a, b) => {
      let result = 0;

      switch (state.field) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'type':
          // Non-technical first (false before true)
          if (a.technical === b.technical) {
            // If same type, sort by name as secondary
            result = a.name.localeCompare(b.name);
          } else {
            result = a.technical === b.technical ? 0 : a.technical ? 1 : -1;
          }
          break;
        case 'created_at':
          if (a.created_at && b.created_at) {
            result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          } else if (a.created_at) {
            result = -1;
          } else if (b.created_at) {
            result = 1;
          }
          break;
        case 'updated_at':
          if (a.updated_at && b.updated_at) {
            result = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          } else if (a.updated_at) {
            result = -1;
          } else if (b.updated_at) {
            result = 1;
          }
          break;
        default:
          result = 0;
      }

      return state.direction === 'desc' ? -result : result;
    });

    return sorted;
  }

  // Update sort criteria
  function updateSort(field: ServiceTypeSortField, direction?: ServiceTypeSortDirection) {
    state.field = field;
    if (direction !== undefined) {
      state.direction = direction;
    }
  }

  // Toggle sort direction for a field
  function toggleSort(field: ServiceTypeSortField) {
    if (state.field === field) {
      // Same field, toggle direction
      state.direction = state.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // Different field, set as new sort field with default direction
      state.field = field;
      state.direction = field === 'type' ? 'asc' : 'desc'; // type defaults to asc (non-technical first), others default to desc
    }
  }

  // Get sort icon for a field
  function getSortIcon(field: ServiceTypeSortField): string {
    if (state.field !== field) {
      return '↕️'; // No sort active for this field
    }
    return state.direction === 'asc' ? '↑' : '↓';
  }

  // Check if currently sorted by a field
  function isSortedBy(field: ServiceTypeSortField): boolean {
    return state.field === field;
  }

  return {
    sortState: state,
    sortServiceTypes,
    updateSort,
    toggleSort,
    getSortIcon,
    isSortedBy
  };
}
