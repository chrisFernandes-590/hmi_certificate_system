/**
 * Certificate PDF flow: the PDF bytes are streamed by the authenticated API
 * (owner-authorized) into the app cache, then handed to the OS share sheet /
 * PDF viewer. No storage URLs are ever exposed.
 */
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { apiDownloadPdf, ApiError } from '@/lib/api'

export async function downloadAndSharePdf(certificateId: string): Promise<void> {
  const { bytes, filename } = await apiDownloadPdf(certificateId, 'attachment')
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_') || `certificate-${certificateId}.pdf`
  const file = new File(Paths.cache, safeName)
  if (file.exists) file.delete()
  file.create()
  file.write(bytes)

  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError(0, 'Sharing is not available on this device. The PDF was saved to the app cache.')
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Certificate PDF',
  })
}
