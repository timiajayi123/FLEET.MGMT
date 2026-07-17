import { PageHeader } from '@/components/page-header';
import { VehicleRequestForm } from '@/app/vehicle-request-form';

export default function NewVehicleRequestPage() {
  return (
    <>
      <PageHeader
        title="New Vehicle Request"
        description="Submit an official transport request for approval. Allocation occurs after approval."
      />
      <VehicleRequestForm embedded />
    </>
  );
}
