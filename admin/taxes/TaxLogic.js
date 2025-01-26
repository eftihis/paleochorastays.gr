document.addEventListener('DOMContentLoaded', async function() {
    const supabase = window.supabase;
    const listingId = getListingIdFromUrl();

    // Initialize tax functionality
    async function initializeTaxes() {
        // Fetch predefined taxes for the select dropdown
        const { data: taxes, error } = await supabase
            .from('taxes')
            .select('*');

        if (error) {
            console.error('Error fetching taxes:', error);
            return;
        }

        // Populate tax select dropdown
        const taxSelect = document.querySelector('[data-element="tax-select"]');
        taxes.forEach(tax => {
            const option = document.createElement('option');
            option.value = tax.id;
            option.textContent = tax.name;
            taxSelect.appendChild(option);
        });

        // Fetch and display existing applied taxes for this listing
        await loadAppliedTaxes();
    }

    // Load existing applied taxes
    async function loadAppliedTaxes() {
        const { data: appliedTaxes, error } = await supabase
            .from('applied_taxes')
            .select(`
                *,
                taxes (
                    name,
                    calculation_type
                )
            `)
            .eq('listing_id', listingId);

        if (error) {
            console.error('Error fetching applied taxes:', error);
            return;
        }

        // Display each applied tax
        appliedTaxes.forEach(displayAppliedTax);
    }

    // Initialize on load
    initializeTaxes();
});