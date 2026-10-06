export const CLIENT_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'searching', label: 'Searching' },
  { value: 'touring', label: 'Touring' },
  { value: 'offer_ready', label: 'Offer Ready' },
  { value: 'offer_submitted', label: 'Offer Submitted' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed', label: 'Closed' },
  { value: 'paused', label: 'Paused' },
] as const

export const PROPERTY_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'coming_soon', label: 'Coming Soon' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'sold', label: 'Sold' },
  { value: 'off_market', label: 'Off Market' },
] as const

export const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'multi_family', label: 'Multi-Family' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
] as const

export const LOAN_TYPES = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'usda', label: 'USDA' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'cash', label: 'Cash' },
] as const

export const PREAPPROVAL_STATUSES = [
  { value: 'none', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'preapproved', label: 'Preapproved' },
  { value: 'expired', label: 'Expired' },
] as const

export const PREFERENCE_TYPES = [
  { value: 'must_have', label: 'Must Have' },
  { value: 'strong_preference', label: 'Strong Preference' },
  { value: 'prefer', label: 'Prefers' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'dislike', label: 'Dislikes' },
  { value: 'strong_dislike', label: 'Strong Dislike' },
  { value: 'deal_breaker', label: 'Deal Breaker' },
] as const

/** Objective, Fair-Housing-safe preference categories only. */
export const PREFERENCE_CATEGORIES = [
  'bedrooms', 'bathrooms', 'price', 'location', 'commute', 'yard', 'garage', 'kitchen', 'basement',
  'size', 'condition', 'taxes', 'hoa', 'layout', 'parking', 'outdoor', 'amenities', 'other',
] as const

export const REACTIONS = [
  { value: 'love', label: 'Love It', emoji: '😍' },
  { value: 'like', label: 'Like', emoji: '👍' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'dislike', label: 'Concern', emoji: '⚠️' },
  { value: 'deal_breaker', label: 'Deal Breaker', emoji: '⛔' },
] as const
export type ReactionValue = (typeof REACTIONS)[number]['value']

export const REACTION_FEATURES = [
  'Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Basement', 'Exterior', 'Yard', 'Garage',
  'Location', 'Condition', 'Other',
] as const

export const PHOTO_SUBJECTS = [
  'Kitchen', 'Roof', 'HVAC', 'Electrical', 'Water Heater', 'Basement', 'Foundation', 'Bathroom',
  'Exterior', 'Other',
] as const

export const TOUR_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD',
  'TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string | null | undefined) {
  return list.find((x) => x.value === value)?.label ?? value ?? '—'
}

export const OFFER_STATUSES = [
  { value: 'considering', label: 'Considering', tone: 'outline' },
  { value: 'preparing', label: 'Preparing', tone: 'accent' },
  { value: 'submitted', label: 'Submitted', tone: 'warning' },
  { value: 'accepted', label: 'Accepted', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'withdrawn', label: 'Withdrawn', tone: 'outline' },
] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]['value']
