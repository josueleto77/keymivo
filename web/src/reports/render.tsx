/** Loaded on demand (react-pdf is large): builds a report PDF blob. */
import { pdf } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { JourneyReport } from './JourneyReport'
import { OfferReport } from './OfferReport'
import { TourReport } from './TourReport'
import { loadJourneyReport, loadOfferReport, loadTourReport, type Agent } from './data'

export type ReportKind = 'offer' | 'tour' | 'journey'

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

export async function buildReport(kind: ReportKind, id: string, agent: Agent): Promise<{ blob: Blob; filename: string }> {
  const day = format(new Date(), 'yyyy-MM-dd')
  if (kind === 'offer') {
    const data = await loadOfferReport(id)
    return { blob: await pdf(<OfferReport data={data} agent={agent} />).toBlob(), filename: `offer-strategy-${slug(data.offer.properties?.address_line1 ?? 'home')}-${day}.pdf` }
  }
  if (kind === 'tour') {
    const data = await loadTourReport(id)
    return { blob: await pdf(<TourReport data={data} agent={agent} />).toBlob(), filename: `tour-summary-${slug(data.tour.name)}-${data.tour.tour_date}.pdf` }
  }
  const data = await loadJourneyReport(id)
  return { blob: await pdf(<JourneyReport data={data} agent={agent} />).toBlob(), filename: `home-search-${slug(`${data.client.first_name} ${data.client.last_name ?? ''}`)}-${day}.pdf` }
}
