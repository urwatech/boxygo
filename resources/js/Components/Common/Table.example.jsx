import React from 'react';
import Table from './Table';

/**
 * Example Usage of Table Component
 *
 * This file demonstrates how to use the Table component with various configurations
 */

// Example 1: Basic Table with Pagination (Based on Vehicles page)
export function VehicleTableExample({ vehicles, paginationMeta, handlePageChange }) {
    const columns = [
        {
            key: 'code',
            label: 'Vehicle ID',
        },
        {
            key: 'assigned_rider',
            label: 'Assigned Rider',
            render: (value) => value?.name ?? 'Unassigned',
        },
        {
            key: 'type',
            label: 'Vehicle Type',
        },
        {
            key: 'license_plate',
            label: 'Plate Number',
        },
        {
            key: 'permit_expires_at',
            label: 'Permit Expiry',
            render: (value) => value ?? '—',
        },
        {
            key: 'insurance_expires_at',
            label: 'Insurance Expiry',
            render: (value) => value ?? '—',
        },
        {
            key: 'status',
            label: 'Status',
            render: (value, row) => {
                const STATUS_STYLES = {
                    pending: 'bg-blue-50 text-blue-700 border border-blue-200',
                    active: 'bg-green-50 text-green-700 border border-green-200',
                    pending_renewal: 'bg-amber-50 text-amber-700 border border-amber-200',
                    inactive: 'bg-red-50 text-red-600 border border-red-200',
                };
                const badgeStyle = STATUS_STYLES[value] ?? 'bg-slate-100 text-slate-600 border border-slate-200';
                return (
                    <span className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium ${badgeStyle}`}>
                        {row.status_label ?? value}
                    </span>
                );
            },
        },
        {
            key: 'action',
            label: 'Action',
            align: 'right',
            render: (value, row) => (
                <button
                    type="button"
                    onClick={() => console.log('Assign vehicle:', row.id)}
                    className="text-blue-500 font-medium hover:underline"
                >
                    {row.assigned_rider ? 'Reassign' : 'Assign'}
                </button>
            ),
        },
    ];

    return (
        <Table
            columns={columns}
            data={vehicles}
            keyField="id"
            emptyMessage="No vehicles match your current filters."
            striped
            hoverable
            pagination
            currentPage={paginationMeta.currentPage}
            totalPages={paginationMeta.totalPages}
            onPageChange={handlePageChange}
            paginationMeta={paginationMeta}
            showPaginationInfo
        />
    );
}

// Example 2: Simple Table without Pagination
export function SimpleTableExample() {
    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
    ];

    const data = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ];

    return (
        <Table
            columns={columns}
            data={data}
            striped
        />
    );
}

// Example 3: Table with Custom Row Click
export function ClickableTableExample() {
    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'product', label: 'Product' },
        { key: 'price', label: 'Price', align: 'right' },
    ];

    const data = [
        { id: 1, product: 'Laptop', price: '$999' },
        { id: 2, product: 'Mouse', price: '$29' },
    ];

    const handleRowClick = (row) => {
        console.log('Row clicked:', row);
    };

    return (
        <Table
            columns={columns}
            data={data}
            onRowClick={handleRowClick}
            hoverable
        />
    );
}

// Example 4: Table with Custom Styling
export function StyledTableExample() {
    const columns = [
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`px-2 py-1 rounded ${value === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {value}
                </span>
            ),
        },
        { key: 'name', label: 'Name' },
    ];

    const data = [
        { id: 1, status: 'active', name: 'Service A' },
        { id: 2, status: 'inactive', name: 'Service B' },
    ];

    return (
        <Table
            columns={columns}
            data={data}
            className="shadow-lg rounded-lg overflow-hidden"
            tableClassName="bg-white"
            theadClassName="bg-blue-600 text-white"
            bordered
        />
    );
}

// Example 5: Table with Dynamic Row Classes
export function DynamicRowTableExample() {
    const columns = [
        { key: 'id', label: 'Order ID' },
        { key: 'amount', label: 'Amount' },
        { key: 'paid', label: 'Paid' },
    ];

    const data = [
        { id: 1, amount: '$100', paid: true },
        { id: 2, amount: '$200', paid: false },
    ];

    const getRowClass = (row) => {
        return row.paid ? 'bg-green-50' : 'bg-red-50';
    };

    return (
        <Table
            columns={columns}
            data={data}
            rowClassName={getRowClass}
        />
    );
}

// Example 6: Complete Configuration Example
export function FullFeaturedTableExample() {
    const columns = [
        { key: 'id', label: 'ID', headerClassName: 'bg-blue-100' },
        {
            key: 'name',
            label: 'Name',
            render: (value, row) => <strong>{value}</strong>,
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (value, row) => (
                <div className="flex gap-2 justify-end">
                    <button className="text-blue-500">Edit</button>
                    <button className="text-red-500">Delete</button>
                </div>
            ),
        },
    ];

    const data = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
    }));

    return (
        <Table
            columns={columns}
            data={data.slice(0, 10)} // Show first 10 items
            keyField="id"
            striped
            hoverable
            bordered
            pagination
            currentPage={1}
            totalPages={5}
            onPageChange={(page) => console.log('Go to page:', page)}
            siblingCount={2}
            boundaryCount={1}
            showPaginationControls
            paginationMeta={{ from: 1, to: 10, total: 50 }}
            showPaginationInfo
            minWidth="600px"
            onRowClick={(row) => console.log('Clicked row:', row)}
        />
    );
}

/**
 * AVAILABLE PROPS:
 *
 * Data Props:
 * - columns: Array of column definitions
 * - data: Array of data rows
 * - keyField: Unique key field for rows (default: 'id')
 * - emptyMessage: Message when no data
 *
 * Style Props:
 * - className: Wrapper classes
 * - tableClassName: Table element classes
 * - theadClassName: thead classes
 * - tbodyClassName: tbody classes
 * - thClassName: th classes
 * - tdClassName: td classes
 * - rowClassName: Row classes or function
 * - minWidth: Minimum table width
 *
 * Behavior Props:
 * - onRowClick: Row click handler
 * - striped: Enable striped rows
 * - bordered: Enable borders
 * - hoverable: Enable hover effect
 *
 * Pagination Props:
 * - pagination: Enable pagination
 * - currentPage: Current page number
 * - totalPages: Total pages
 * - onPageChange: Page change handler
 * - siblingCount: Siblings around current page
 * - boundaryCount: Boundary pages count
 * - showPaginationControls: Show prev/next buttons
 * - paginationDisabled: Disable pagination
 * - paginationClassName: Pagination wrapper classes
 * - paginationMeta: Meta info { from, to, total }
 * - showPaginationInfo: Show pagination info text
 */
