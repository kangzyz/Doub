package channel

import (
	"context"
	"errors"
	"reflect"
	"testing"

	domainchannel "github.com/kangzyz/Doub/backend/internal/domain/channel"
	"github.com/kangzyz/Doub/backend/internal/infra/config"
	"github.com/kangzyz/Doub/backend/internal/repository"
)

type modelServiceRepo struct {
	repository.ChannelRepository

	listInput  repository.ListChannelModelsInput
	listRows   []repository.ChannelModelListRow
	listTotal  int64
	reorderIDs []uint
	reorderErr error
}

func (r *modelServiceRepo) ListModels(_ context.Context, input repository.ListChannelModelsInput) ([]repository.ChannelModelListRow, int64, error) {
	r.listInput = input
	return r.listRows, r.listTotal, nil
}

func (r *modelServiceRepo) ReorderModels(_ context.Context, orderedModelIDs []uint) error {
	r.reorderIDs = append([]uint(nil), orderedModelIDs...)
	return r.reorderErr
}

func TestListModelsPassesAvailabilityFilters(t *testing.T) {
	repo := &modelServiceRepo{
		listRows: []repository.ChannelModelListRow{
			{
				PlatformModel: domainchannel.PlatformModel{
					ID:                8,
					PlatformModelName: "gpt-test",
					Vendor:            "openai",
					Status:            "active",
				},
				SourceCount:       2,
				ActiveSourceCount: 1,
			},
		},
		listTotal: 1,
	}
	service := NewService(config.Config{}, repo, nil, nil)

	views, total, err := service.ListModels(context.Background(), 3, 25, ListModelsInput{
		OnlyActive:    true,
		OnlyAvailable: true,
		Query:         "gpt",
		Status:        "active",
		Vendor:        "openai",
		Protocol:      "openai_responses",
		Sort:          "sortOrder_asc",
	})
	if err != nil {
		t.Fatalf("ListModels() error = %v", err)
	}
	if total != 1 || len(views) != 1 || views[0].PlatformModelName != "gpt-test" {
		t.Fatalf("ListModels() returned total=%d views=%#v", total, views)
	}

	wantInput := repository.ListChannelModelsInput{
		Offset:        50,
		Limit:         25,
		OnlyActive:    true,
		OnlyAvailable: true,
		Query:         "gpt",
		Status:        "active",
		Vendor:        "openai",
		Protocol:      "openai_responses",
		Sort:          "sortOrder_asc",
	}
	if !reflect.DeepEqual(repo.listInput, wantInput) {
		t.Fatalf("ListModels() input = %#v, want %#v", repo.listInput, wantInput)
	}
}

func TestReorderModelsValidatesIDsBeforeRepository(t *testing.T) {
	for _, ids := range [][]uint{
		nil,
		{},
		{0},
		{1, 1},
	} {
		repo := &modelServiceRepo{}
		service := NewService(config.Config{}, repo, nil, nil)

		if err := service.ReorderModels(context.Background(), ids); !errors.Is(err, ErrInvalidModelOrder) {
			t.Fatalf("ReorderModels(%#v) error = %v, want ErrInvalidModelOrder", ids, err)
		}
		if repo.reorderIDs != nil {
			t.Fatalf("ReorderModels(%#v) called repository with %#v", ids, repo.reorderIDs)
		}
	}
}

func TestReorderModelsMapsRepositoryErrors(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want error
	}{
		{name: "invalid input", err: repository.ErrInvalidInput, want: ErrInvalidModelOrder},
		{name: "missing model", err: repository.ErrModelNotFound, want: ErrModelNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &modelServiceRepo{reorderErr: tt.err}
			service := NewService(config.Config{}, repo, nil, nil)

			if err := service.ReorderModels(context.Background(), []uint{3, 4}); !errors.Is(err, tt.want) {
				t.Fatalf("ReorderModels() error = %v, want %v", err, tt.want)
			}
			if !reflect.DeepEqual(repo.reorderIDs, []uint{3, 4}) {
				t.Fatalf("repository ids = %#v, want [3 4]", repo.reorderIDs)
			}
		})
	}
}

func TestReorderModelsInvalidatesCatalogOnSuccess(t *testing.T) {
	repo := &modelServiceRepo{}
	service := NewService(config.Config{}, repo, nil, nil)
	service.modelCatalog = []ModelView{{ID: 1, PlatformModelName: "stale"}}

	if err := service.ReorderModels(context.Background(), []uint{2, 1}); err != nil {
		t.Fatalf("ReorderModels() error = %v", err)
	}
	if !reflect.DeepEqual(repo.reorderIDs, []uint{2, 1}) {
		t.Fatalf("repository ids = %#v, want [2 1]", repo.reorderIDs)
	}
	if service.modelCatalog != nil {
		t.Fatalf("model catalog was not invalidated: %#v", service.modelCatalog)
	}
}
