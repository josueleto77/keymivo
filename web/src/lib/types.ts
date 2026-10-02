import type { Database } from './database.types'

type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']
export type Insert<T extends keyof Tables> = Tables[T]['Insert']
export type Update<T extends keyof Tables> = Tables[T]['Update']

export type Profile = Row<'profiles'>
export type Organization = Row<'organizations'>
export type Client = Row<'clients'>
export type ClientMember = Row<'client_members'>
export type ClientPreference = Row<'client_preferences'>
export type Property = Row<'properties'>
export type PropertyPhoto = Row<'property_photos'>
export type PropertyScore = Row<'property_scores'>
export type Tour = Row<'tours'>
export type TourProperty = Row<'tour_properties'>
export type Showing = Row<'showings'>
export type ShowingNote = Row<'showing_notes'>
export type BuyerReaction = Row<'buyer_reactions'>
export type Task = Row<'tasks'>
export type ActivityLog = Row<'activity_logs'>
