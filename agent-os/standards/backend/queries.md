# Holochain Query Patterns & Data Retrieval

This document defines the standards and patterns for Holochain queries, data retrieval, and DHT optimization in the requests-and-offers project.

## Core Principles

### Holochain Query Optimization
- **Link-Based Queries**: Use Holochain's link system for relationship queries instead of joins
- **DHT Efficiency**: Structure queries to minimize DHT hops and network calls
- **Pagination Strategy**: Implement pagination for large datasets to avoid memory issues
- **Caching**: Cache frequently accessed data to reduce DHT load
- **Batch Operations**: Group related queries to minimize round trips

### Query Architecture Patterns
- **Single Source of Truth**: Use links as the authoritative source for relationships
- **Avoid Redundant Data**: Don't store data that can be derived through links
- **Lazy Loading**: Load related data only when needed
- **Efficient Filtering**: Apply filters at the DHT level when possible
- **Consistent Ordering**: Use consistent sorting across all queries

## Link Query Patterns

### Basic Link Queries
```rust
use hdk::prelude::*;

// Get all records of a specific link type
pub fn get_service_types_for_request(
    request_hash: ActionHash
) -> ExternResult<Vec<Record>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(
            request_hash,
            LinkTypes::RequestToServiceType
        )?
            .build()
    )?;

    let records: Result<Vec<_>, _> = links
        .into_iter()
        .filter_map(|link| get_latest_record(link.target).ok())
        .collect();

    Ok(records)
}

// Get links with metadata (using LinkTags)
pub fn get_requests_with_priority(
    service_type_hash: ActionHash
) -> ExternResult<Vec<(Record, String)>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(
            service_type_hash,
            LinkTypes::ServiceTypeToRequest
        )?
            .build()
    )?;

    let results: Result<Vec<_>, _> = links
        .into_iter()
        .filter_map(|link| {
            let priority = String::from_utf8(link.tag.to_vec()).ok()?;
            let record = get_latest_record(link.target).ok()?;
            Some((record, priority))
        })
        .collect();

    Ok(results)
}

// Reverse link queries (get parents of a child)
pub fn get_parent_requests(
    request_hash: ActionHash
) -> ExternResult<Vec<Record>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(
            request_hash,
            LinkTypes::UserToRequest
        )?
            .build()
    )?;

    let records: Result<Vec<_>, _> = links
        .into_iter()
        .filter_map(|link| get_latest_record(link.target).ok())
        .collect();

    Ok(records)
}
```

### Complex Link Traversals
```rust
// Multi-hop relationship traversal
pub fn get_requests_by_organization_and_service_type(
    organization_hash: ActionHash,
    service_type_hash: ActionHash
) -> ExternResult<Vec<Record>> {
    // Get requests linked to organization
    let org_request_links = get_links(
        GetLinksInputBuilder::try_new(
            organization_hash,
            LinkTypes::OrganizationToRequest
        )?
            .build()
    )?;

    // Filter requests by service type
    let mut matching_requests = Vec::new();

    for link in org_request_links {
        // Get service type links for this request
        let service_type_links = get_links(
            GetLinksInputBuilder::try_new(
                link.target,
                LinkTypes::RequestToServiceType
            )?
                .build()
        )?;

        // Check if this request is linked to our target service type
        let has_target_service_type = service_type_links
            .iter()
            .any(|st_link| st_link.target == service_type_hash);

        if has_target_service_type {
            if let Some(record) = get_latest_record(link.target).ok() {
                matching_requests.push(record);
            }
        }
    }

    Ok(matching_requests)
}

// Hierarchical data traversal with depth limit
pub fn get_organization_tree(
    root_hash: ActionHash,
    max_depth: usize
) -> ExternResult<Vec<(Record, usize)>> {
    let mut result = Vec::new();
    let mut current_level = vec![root_hash];

    for depth in 0..max_depth {
        let mut next_level = Vec::new();

        for hash in current_level {
            if let Some(record) = get_latest_record(hash).ok() {
                result.push((record, depth));

                // Get child organizations
                let child_links = get_links(
                    GetLinksInputBuilder::try_new(
                        hash,
                        LinkTypes::OrganizationToOrganization
                    )?
                    .build()
                )?;

                for child_link in child_links {
                    next_level.push(child_link.target);
                }
            }
        }

        if next_level.is_empty() {
            break;
        }

        current_level = next_level;
    }

    Ok(result)
}
```

## Pagination Patterns

### Link-Based Pagination
```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QueryOptions {
    pub page: Option<usize>,
    pub page_size: Option<usize>,
    pub sort_by: Option<String>,
    pub sort_direction: Option<SortDirection>,
    pub filters: Option<QueryFilters>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QueryFilters {
    pub status: Option<WorkflowStatus>,
    pub category: Option<ServiceTypeCategory>,
    pub date_range: Option<DateRange>,
    pub search_term: Option<String>,
}

pub struct LinkQueryHelper;

impl LinkQueryHelper {
    pub fn paginate_links(
        links: Vec<Link>,
        page: usize,
        page_size: usize
    ) -> Vec<Link> {
        let start_index = page * page_size;
        let end_index = start_index + page_size;

        links
            .into_iter()
            .skip(start_index)
            .take(page_size)
            .collect()
    }

    pub fn paginate_records<T>(
        records: Vec<T>,
        page: usize,
        page_size: usize
    ) -> Vec<T> {
        let start_index = page * page_size;
        let end_index = start_index + page_size;

        records
            .into_iter()
            .skip(start_index)
            .take(page_size)
            .collect()
    }

    pub fn get_paginated_results(
        base_hash: ActionHash,
        link_type: LinkTypes,
        options: &QueryOptions
    ) -> ExternResult<PaginatedResults<Record>> {
        let links = get_links(
            GetLinksInputBuilder::try_new(base_hash, link_type)?
                .build()
        )?;

        // Apply filters
        let filtered_links = Self::apply_filters(links, &options.filters);

        // Sort links
        let sorted_links = Self::sort_links(filtered_links, &options.sort_by, &options.sort_direction);

        // Paginate
        let total_count = sorted_links.len();
        let page = options.page.unwrap_or(0);
        let page_size = options.page_size.unwrap_or(20);
        let paginated_links = Self::paginate_links(sorted_links, page, page_size);

        // Get records for paginated links
        let records: Result<Vec<_>, _> = paginated_links
            .into_iter()
            .filter_map(|link| get_latest_record(link.target).ok())
            .collect();

        Ok(PaginatedResults {
            items: records,
            total_count,
            page,
            page_size,
            total_pages: (total_count + page_size - 1) / page_size,
        })
    }

    fn apply_filters(
        links: Vec<Link>,
        filters: &Option<QueryFilters>,
    ) -> Vec<Link> {
        let filters = match filters {
            Some(f) => f,
            None => return links,
        };

        links
            .into_iter()
            .filter(|link| {
                // Apply status filter via link tags if needed
                if let Some(status) = &filters.status {
                    // Check if link tag contains status information
                    let tag_str = String::from_utf8(link.tag.to_vec()).unwrap_or_default();
                    tag_str.contains(&format!("{:?}", status))
                } else {
                    true
                }
            })
            .collect()
    }

    fn sort_links(
        links: Vec<Link>,
        sort_by: &Option<String>,
        sort_direction: &Option<SortDirection>,
    ) -> Vec<Link> {
        let sort_by = sort_by.as_deref().unwrap_or("timestamp");
        let sort_direction = sort_direction.as_ref().unwrap_or(&SortDirection::Asc);

        let mut links = links;

        match sort_by.as_str() {
            "timestamp" => {
                links.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
            },
            "hash" => {
                links.sort_by(|a, b| a.author.cmp(&b.author));
            },
            _ => {
                // Default sorting
                links.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
            }
        }

        if matches!(sort_direction, SortDirection::Desc) {
            links.reverse();
        }

        links
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PaginatedResults<T> {
    pub items: Vec<T>,
    pub total_count: usize,
    pub page: usize,
    pub page_size: usize,
    pub total_pages: usize,
}
```

## Filter and Search Patterns

### Tag-Based Filtering
```rust
pub struct QueryFilter;

impl QueryFilter {
    pub fn filter_by_status(
        links: Vec<Link>,
        status: &WorkflowStatus
    ) -> Vec<Link> {
        links
            .into_iter()
            .filter(|link| {
                let tag_str = String::from_utf8(link.tag.to_vec()).unwrap_or_default();
                tag_str.contains(&format!("status:{}", status))
            })
            .collect()
    }

    pub fn filter_by_category(
        records: Vec<Record>,
        category: &ServiceTypeCategory
    ) -> Vec<Record> {
        records
            .into_iter()
            .filter(|record| {
                if let Ok(service_type) = ServiceType::try_from(record.entry().as_option()
                    .ok_or("Entry not found").as_ref()) {
                    service_type.category == *category
                } else {
                    false
                }
            })
            .collect()
    }

    pub fn search_by_text(
        records: Vec<Record>,
        search_term: &str
    ) -> Vec<Record> {
        let search_lower = search_term.to_lowercase();

        records
            .into_iter()
            .filter(|record| {
                if let Ok(service_type) = ServiceType::try_from(record.entry().as_option()
                    .ok_or("Entry not found").as_ref()) {
                    service_type.name.to_lowercase().contains(&search_lower)
                        || service_type
                            .description
                            .as_ref()
                            .map(|d| d.to_lowercase().contains(&search_lower))
                            .unwrap_or(false)
                } else {
                    false
                }
            })
            .collect()
    }
}
```

### Advanced Filtering Combinations
```rust
pub struct AdvancedQuery;

impl AdvancedQuery {
    pub fn get_filtered_service_types(
        options: &QueryOptions
    ) -> ExternResult<Vec<ServiceTypeWithMetadata>> {
        // Get all service types (by status)
        let all_service_types = match &options.filters {
            Some(filters) => {
                match &filters.status {
                    Some(status) => {
                        match status {
                            WorkflowStatus::Approved => get_approved_service_types(None),
                            WorkflowStatus::Pending => get_pending_service_types(None),
                            WorkflowStatus::Rejected => get_rejected_service_types(None),
                        }
                    },
                    None => get_all_service_types(None),
                }
            },
            None => get_all_service_types(None),
        };

        let mut filtered_types = Vec::new();

        for record in all_service_types {
            if let Ok(service_type) = ServiceType::try_from(record.entry().as_option()
                .ok_or("Entry not found").as_ref()) {
                let include = Self::matches_filters(&service_type, &options.filters);

                if include {
                    let metadata = ServiceTypeWithMetadata {
                        service_type,
                        created_at: record.action().timestamp(),
                        updated_at: Self::get_updated_timestamp(record),
                        action_hash: record.signed_action.hashed.hash,
                        link_count: Self::count_relationships(record),
                    };
                    filtered_types.push(metadata);
                }
            }
        }

        // Apply additional filters
        if let Some(filters) = &options.filters {
            filtered_types = Self::apply_complex_filters(filtered_types, filters);
        }

        // Apply search
        if let Some(search_term) = &options.search_term {
            filtered_types = QueryFilter::search_by_text(
                filtered_types,
                search_term
            );
        }

        // Sort results
        filtered_types.sort_by(|a, b| {
            match options.sort_by.as_deref() {
                Some("name") => a.service_type.name.cmp(&b.service_type.name),
                Some("created_at") => a.created_at.cmp(&b.created_at),
                Some("link_count") => a.link_count.cmp(&b.link_count),
                _ => a.service_type.name.cmp(&b.service_type.name),
            }
        });

        if matches!(options.sort_direction, Some(SortDirection::Desc)) {
            filtered_types.reverse();
        }

        // Paginate results
        let page = options.page.unwrap_or(0);
        let page_size = options.page_size.unwrap_or(20);
        let start_index = page * page_size;
        let end_index = start_index + page_size;

        Ok(filtered_types
            .into_iter()
            .skip(start_index)
            .take(page_size)
            .collect())
    }

    fn matches_filters(
        service_type: &ServiceType,
        filters: &QueryFilters
    ) -> bool {
        let category_match = match &filters.category {
            Some(category) => service_type.category == *category,
            None => true,
        };

        let technical_match = match filters.technical {
            Some(technical) => service_type.technical == *technical,
            None => true,
        };

        category_match && technical_match
    }

    fn apply_complex_filters(
        service_types: Vec<ServiceTypeWithMetadata>,
        filters: &QueryFilters,
    ) -> Vec<ServiceTypeWithMetadata> {
        service_types
            .into_iter()
            .filter(|item| {
                // Date range filtering
                if let Some(date_range) = &filters.date_range {
                    let created_at = chrono::DateTime::from_timestamp(
                        item.created_at as i64
                    );
                    let start = chrono::DateTime::from_timestamp(
                        date_range.start as i64
                    );
                    let end = chrono::DateTime::from_timestamp(
                        date_range.end as i64
                    );

                    if created_at < start || created_at > end {
                        return false;
                    }
                }

                true
            })
            .collect()
    }

    fn get_updated_timestamp(record: &Record) -> u64 {
        match record.action() {
            Action::Update(update_action) => update_action.timestamp,
            Action::Create(_) => record.action().timestamp(),
            Action::Delete(_) => record.action().timestamp(),
        }
    }

    fn count_relationships(
        record: &Record
    ) -> usize {
        // Count all links for this record
        let mut count = 0;

        // Count outgoing links
        let outgoing_types = vec![
            LinkTypes::RequestToServiceType,
            LinkTypes::OfferToServiceType,
            LinkTypes::UserToRequest,
            LinkTypes::UserToOffer,
            LinkTypes::OrganizationToRequest,
            LinkTypes::OrganizationToOffer,
        ];

        for link_type in outgoing_types {
            count += get_links(
                GetLinksInputBuilder::try_new(
                    record.signed_action.hashed.hash,
                    link_type
                )?
                .build()
            ).map(|links| links.len()).unwrap_or(0);
        }

        count
    }
}
```

## Performance Optimization

### Efficient DHT Query Patterns
```rust
pub struct DHTQueryOptimizer;

impl DHTQueryOptimizer {
    // Batch multiple link queries
    pub fn batch_get_linked_records(
        base_hashes: Vec<ActionHash>,
        link_type: LinkTypes
    ) -> ExternResult<Vec<(ActionHash, Vec<Record>)> {
        let mut results = Vec::new();

        for base_hash in base_hashes {
            let links = get_links(
                GetLinksInputBuilder::try_new(base_hash, link_type)?
                    .build()
            )?;

            let records: Result<Vec<_>, _> = links
                .into_iter()
                .filter_map(|link| get_latest_record(link.target).ok())
                .collect();

            results.push((base_hash, records));
        }

        Ok(results)
    }

    // Parallel query execution for independent queries
    pub fn parallel_entity_queries(
        user_hash: ActionHash,
        query_params: &ParallelQueryParams
    ) -> ExternResult<ParallelQueryResults> {
        // Spawn parallel queries for different entity types
        let service_types_future = async_std::task::spawn_blocking_in_place(|| {
            Self::get_user_service_types(user_hash)
        });

        let requests_future = async_std::task::spawn_blocking_in_place(|| {
            Self::get_user_requests(user_hash)
        });

        let offers_future = async_std::task::spawn_blocking_in_place(|| {
            Self::get_user_offers(user_hash)
        });

        // Wait for all queries to complete
        let (service_types, requests, offers) = tokio::join!(
            service_types_future,
            requests_future,
            offers_future
        );

        Ok(ParallelQueryResults {
            service_types: service_types?,
            requests: requests?,
            offers: offers?,
        })
    }

    // Cache-aware queries
    pub fn get_cached_results<T>(
        cache_key: &str,
        query_fn: impl Fn() -> Result<T, ZomeError>,
    ) -> Result<T, ZomeError> {
        // Check cache first
        if let Some(cached) = get_from_cache::<T>(cache_key) {
            return Ok(cached);
        }

        // Execute query
        let result = query_fn()?;

        // Store in cache
        put_in_cache(cache_key, &result)?;

        Ok(result)
    }
}

#[derive(Debug)]
pub struct ParallelQueryParams {
    pub include_status: Option<Vec<WorkflowStatus>>,
    pub date_range: Option<DateRange>,
    pub search_term: Option<String>,
}

#[derive(Debug)]
pub struct ParallelQueryResults {
    pub service_types: Vec<ServiceTypeWithMetadata>,
    pub requests: Vec<RequestWithMetadata>,
    pub offers: Vec<OfferWithMetadata>,
}
```

## Error Handling in Queries

### Graceful Query Error Handling
```rust
use crate::integrity::errors::*;

pub struct QueryErrorHandler;

impl QueryErrorHandler {
    pub fn safe_get_record(
        hash: ActionHash
    ) -> Option<Record> {
        match get_latest_record(hash) {
            Ok(record) => Some(record),
            Err(WasmError::Guest(e)) => {
                error!("Failed to get record: {:?}", e);
                None
            }
        }
    }

    pub fn safe_get_links(
        base_hash: ActionHash,
        link_type: LinkTypes
    ) -> Vec<Link> {
        match get_links(
            GetLinksInputBuilder::try_new(base_hash, link_type)?
                .build()
        ) {
            Ok(links) => links,
            Err(WasmError::Guest(e)) => {
                error!("Failed to get links: {:?}", e);
                Vec::new()
            }
        }
    }

    pub fn handle_query_error<T>(
        result: Result<T, ZomeError>,
        error_context: &str
    ) -> Option<T> {
        match result {
            Ok(data) => Some(data),
            Err(e) => {
                error!("{} failed: {:?}", error_context, e);
                None
            }
        }
    }

    pub fn batch_query_with_error_handling(
        queries: Vec<(&str, Result<Record, ZomeError>)>
    ) -> Vec<Record> {
        queries
            .into_iter()
            .filter_map(|(context, result)| {
                Self::handle_query_error(result, context)
            })
            .filter_map(|option| option)
            .collect()
    }
}
```

## Best Practices Summary

### ✅ **DO:**
- Use link-based queries for all relationships
- Implement pagination for large datasets
- Cache frequently accessed data
- Batch related queries to minimize DHT calls
- Apply filters at the appropriate level (DHT or application)
- Use consistent sorting across all queries
- Handle errors gracefully with fallbacks
- Create helper functions for complex queries
- Test query performance with realistic data volumes

### ❌ **DON'T:**
- Use JOIN-like operations (not available in Holochain)
 Store redundant relationship data in entries
- Return unpaginated result sets by default
- Ignore DHT performance characteristics
- Mix filtering logic with business logic
- Create overly complex query structures
- Skip error handling for edge cases
- Assume data availability without validation

### **Holochain-Specific Patterns:**
- Link traversal for relationship queries
- Action header timestamp extraction
- Bidirectional link creation for queries
- DHT-aware pagination strategies
- Parallel query execution for independent data
- Cache-aware query optimization
- Error recovery with graceful degradation
- Performance monitoring for query optimization

These query patterns ensure efficient, scalable Holochain applications that effectively leverage the distributed nature of the DHT while maintaining good performance characteristics.