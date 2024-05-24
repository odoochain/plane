import random
import string

# Third party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from ..base import BaseViewSet, BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Project, Estimate, EstimatePoint, Issue
from plane.app.serializers import (
    EstimateSerializer,
    EstimatePointSerializer,
    EstimateReadSerializer,
)
from plane.utils.cache import invalidate_cache


def generate_random_name(length=10):
    letters = string.ascii_lowercase
    return "".join(random.choice(letters) for i in range(length))


class ProjectEstimatePointEndpoint(BaseAPIView):
    permission_classes = [
        ProjectEntityPermission,
    ]

    def get(self, request, slug, project_id):
        project = Project.objects.get(workspace__slug=slug, pk=project_id)
        if project.estimate_id is not None:
            estimate_points = EstimatePoint.objects.filter(
                estimate_id=project.estimate_id,
                project_id=project_id,
                workspace__slug=slug,
            )
            serializer = EstimatePointSerializer(estimate_points, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response([], status=status.HTTP_200_OK)


class BulkEstimatePointEndpoint(BaseViewSet):
    permission_classes = [
        ProjectEntityPermission,
    ]
    model = Estimate
    serializer_class = EstimateSerializer

    def list(self, request, slug, project_id):
        estimates = (
            Estimate.objects.filter(
                workspace__slug=slug, project_id=project_id
            )
            .prefetch_related("points")
            .select_related("workspace", "project")
        )
        serializer = EstimateReadSerializer(estimates, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @invalidate_cache(
        path="/api/workspaces/:slug/estimates/", url_params=True, user=False
    )
    def create(self, request, slug, project_id):
        estimate_name = generate_random_name()
        estimate = Estimate.objects.create(
            name=estimate_name, project_id=project_id
        )

        estimate_points = request.data.get("estimate_points", [])

        serializer = EstimatePointSerializer(
            data=request.data.get("estimate_points"), many=True
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        estimate_points = EstimatePoint.objects.bulk_create(
            [
                EstimatePoint(
                    estimate=estimate,
                    key=estimate_point.get("key", 0),
                    value=estimate_point.get("value", ""),
                    description=estimate_point.get("description", ""),
                    project_id=project_id,
                    workspace_id=estimate.workspace_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
                for estimate_point in estimate_points
            ],
            batch_size=10,
            ignore_conflicts=True,
        )

        estimate_point_serializer = EstimatePointSerializer(
            estimate_points, many=True
        )

        return Response(
            {
                "estimate_points": estimate_point_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, slug, project_id, estimate_id):
        estimate = Estimate.objects.get(
            pk=estimate_id, workspace__slug=slug, project_id=project_id
        )
        serializer = EstimateReadSerializer(estimate)
        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @invalidate_cache(
        path="/api/workspaces/:slug/estimates/", url_params=True, user=False
    )
    def partial_update(self, request, slug, project_id, estimate_id):

        if not len(request.data.get("estimate_points", [])):
            return Response(
                {"error": "Estimate points are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _ = Estimate.objects.get(pk=estimate_id)

        estimate_points_data = request.data.get("estimate_points", [])

        estimate_points = EstimatePoint.objects.filter(
            pk__in=[
                estimate_point.get("id")
                for estimate_point in estimate_points_data
            ],
            workspace__slug=slug,
            project_id=project_id,
            estimate_id=estimate_id,
        )

        updated_estimate_points = []
        for estimate_point in estimate_points:
            # Find the data for that estimate point
            estimate_point_data = [
                point
                for point in estimate_points_data
                if point.get("id") == str(estimate_point.id)
            ]
            if len(estimate_point_data):
                estimate_point.value = estimate_point_data[0].get(
                    "value", estimate_point.value
                )
                updated_estimate_points.append(estimate_point)

        EstimatePoint.objects.bulk_update(
            updated_estimate_points,
            ["value"],
            batch_size=10,
        )

        estimate_point_serializer = EstimatePointSerializer(
            estimate_points, many=True
        )
        return Response(
            {
                "estimate_points": estimate_point_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @invalidate_cache(
        path="/api/workspaces/:slug/estimates/", url_params=True, user=False
    )
    def destroy(self, request, slug, project_id, estimate_id):
        estimate = Estimate.objects.get(
            pk=estimate_id, workspace__slug=slug, project_id=project_id
        )
        estimate.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeleteEstimatePoint(BaseViewSet):
    permission_classes = [
        ProjectEntityPermission,
    ]

    def partial_update(
        self, request, slug, project_id, estimate_id, estimate_point_id
    ):
        new_estimate_id = request.data.get("new_estimate_id", None)
        estimate_points = EstimatePoint.objects.filter(
            estimate_id=estimate_id,
            project_id=project_id,
            workspace__slug=slug,
        )
        # update all the issues with the new estimate
        if new_estimate_id:
            _ = Issue.objects.filter(
                project_id=project_id,
                workspace__slug=slug,
                estimate_id=estimate_point_id,
            ).update(estimate_id=new_estimate_id)

        # delete the estimate point
        old_estimate_point = EstimatePoint.objects.filter(
            pk=estimate_point_id
        ).first()

        # rearrange the estimate points
        updated_estimate_points = []
        for estimate_point in estimate_points:
            if estimate_point.key > old_estimate_point.key:
                estimate_point.key -= 1
                updated_estimate_points.append(estimate_point)

        EstimatePoint.objects.bulk_update(
            updated_estimate_points,
            ["key"],
            batch_size=10,
        )

        old_estimate_point.delete()

        return Response(
            EstimatePointSerializer(updated_estimate_points, many=True).data,
            status=status.HTTP_200_OK,
        )
